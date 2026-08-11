import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { runPaymentTransaction } from '../../transactions.ts';
import { findLegacyPaymentContext } from '../../webhook-legacy.ts';
import { updateUserRegistrationAfterRefund } from '../../codes.ts';
import { switchPixSessionToCreditCard } from '../../pix-switch.ts';
import {
    CUSTOMER_PROVISIONING_COLLECTION,
    ensureAsaasCustomer,
    type CustomerProvisioningDocument,
} from '../../customer-provisioning.ts';
import {
    claimWebhookEvent,
    clearWebhookLedgerReadinessCache,
    ensureWebhookLedgerReady,
    failWebhookEvent,
    finishWebhookEvent,
    ingestWebhookEvent,
    LEGACY_WEBHOOK_EVENTS_COLLECTION,
    WEBHOOK_EVENTS_V2_COLLECTION,
    WEBHOOK_EVENT_UNIQUE_INDEX,
} from '../../webhook-ledger.ts';

let replicaSet: MongoMemoryReplSet;
let client: MongoClient;
const execFileAsync = promisify(execFile);

before(async () => {
    replicaSet = await MongoMemoryReplSet.create({
        binary: { version: process.env.MONGOMS_VERSION || '8.0.13' },
        replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    client = new MongoClient(replicaSet.getUri());
    await client.connect();
});

after(async () => {
    await client?.close();
    const { connectToDatabase } = await import('../../../mongodb.js');
    const { client: webhookWorkerClient } = await connectToDatabase();
    await webhookWorkerClient.close();
    await replicaSet?.stop();
});

beforeEach(async () => {
    await client.db('webhook_tests').dropDatabase();
    clearWebhookLedgerReadinessCache();
});

async function createLedgerIndexes() {
    const db = client.db('webhook_tests');
    await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).createIndexes([
        {
            key: { provider: 1, eventId: 1 },
            name: WEBHOOK_EVENT_UNIQUE_INDEX,
            unique: true,
        },
        {
            key: { status: 1, nextAttemptAt: 1, leaseUntil: 1, receivedAt: 1 },
            name: 'payment_webhook_event_v2_work_queue',
        },
    ]);
    return db;
}

function customerPayload(userId: string) {
    return {
        name: 'Pessoa de Teste',
        email: 'teste@example.invalid',
        cpfCnpj: '00000000000',
        mobilePhone: '00000000000',
        observations: userId,
        notificationDisabled: true as const,
        externalReference: userId,
        address: 'Endereco de teste',
        addressNumber: '1',
        postalCode: '00000000',
        city: 'Cidade de teste',
    };
}

test('provisionamento concorrente faz um unico POST de customer', async () => {
    const db = client.db('webhook_tests');
    const userId = new ObjectId().toHexString();
    let lookupCalls = 0;
    let createCalls = 0;
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
            createCalls += 1;
            return Response.json({ id: 'cus_concurrent' });
        }
        lookupCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return Response.json({ data: [] });
    }) as typeof fetch;

    const results = await Promise.all(
        Array.from({ length: 20 }, () => ensureAsaasCustomer({
            db,
            userId,
            customer: customerPayload(userId),
            apiUrl: 'https://api-sandbox.asaas.com/v3',
            apiKey: 'test-key',
            fetchImpl: fetchMock,
        })),
    );

    assert.equal(lookupCalls, 1);
    assert.equal(createCalls, 1);
    assert.equal(results.filter((result) => result.ok).length >= 1, true);
    assert.equal(
        (await db.collection<CustomerProvisioningDocument>(
            CUSTOMER_PROVISIONING_COLLECTION,
        ).findOne({ _id: userId }))
            ?.customerId,
        'cus_concurrent',
    );
});

test('resposta perdida do POST e recuperada por GET sem segundo POST', async () => {
    const db = client.db('webhook_tests');
    const userId = new ObjectId().toHexString();
    let customerExists = false;
    let createCalls = 0;
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
            createCalls += 1;
            customerExists = true;
            throw new Error('simulated response loss');
        }
        return Response.json({
            data: customerExists
                ? [{ id: 'cus_recovered', externalReference: userId }]
                : [],
        });
    }) as typeof fetch;

    const first = await ensureAsaasCustomer({
        db,
        userId,
        customer: customerPayload(userId),
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: fetchMock,
    });
    assert.deepEqual(first, {
        ok: false,
        code: 'CUSTOMER_RECONCILIATION_REQUIRED',
        status: 503,
    });

    const second = await ensureAsaasCustomer({
        db,
        userId,
        customer: customerPayload(userId),
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: fetchMock,
    });
    assert.deepEqual(second, {
        ok: true,
        customerId: 'cus_recovered',
        source: 'lookup',
    });
    assert.equal(createCalls, 1);
});

test('customers duplicados ficam em revisao sem novo POST', async () => {
    const db = client.db('webhook_tests');
    const userId = new ObjectId().toHexString();
    let createCalls = 0;
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') createCalls += 1;
        return Response.json({
            data: [
                { id: 'cus_duplicate_1', externalReference: userId },
                { id: 'cus_duplicate_2', externalReference: userId },
            ],
        });
    }) as typeof fetch;

    const result = await ensureAsaasCustomer({
        db,
        userId,
        customer: customerPayload(userId),
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: fetchMock,
    });
    assert.deepEqual(result, {
        ok: false,
        code: 'CUSTOMER_RECONCILIATION_REQUIRED',
        status: 409,
    });
    assert.equal(createCalls, 0);
    assert.equal(
        (await db.collection<CustomerProvisioningDocument>(
            CUSTOMER_PROVISIONING_COLLECTION,
        ).findOne({ _id: userId }))
            ?.status,
        'REVIEW_REQUIRED',
    );
});

test('resposta de lookup malformada falha fechada sem criar customer', async () => {
    const db = client.db('webhook_tests');
    const userId = new ObjectId().toHexString();
    let createCalls = 0;
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') createCalls += 1;
        return Response.json({ unexpected: true });
    }) as typeof fetch;

    const result = await ensureAsaasCustomer({
        db,
        userId,
        customer: customerPayload(userId),
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: fetchMock,
    });
    assert.deepEqual(result, {
        ok: false,
        code: 'CUSTOMER_LOOKUP_FAILED',
        status: 503,
    });
    assert.equal(createCalls, 0);
});

async function seedModernPayment(
    db: ReturnType<MongoClient['db']>,
    options: {
        status?: string;
        method?: string;
        paymentId?: string;
        invoiceNumber?: string;
        customer?: string;
        installmentPlan?: Record<string, unknown>;
    } = {},
) {
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    const status = options.status || 'PAYMENT_PENDING';
    const paymentId = options.paymentId || `pay_${purchaseId.toHexString()}`;
    const invoiceNumber = options.invoiceNumber || `inv_${purchaseId.toHexString()}`;
    const customer = options.customer || `cus_${owner.toHexString()}`;
    const method = options.method || 'CREDIT_CARD';
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: customer,
        pagamento: {
            situacao: status === 'CONFIRMED' ? 1 : 2,
            ...(status === 'CONFIRMED'
                ? { edicaoId: 'CIEPS-2026', compraId: purchaseId }
                : {}),
            lista_pagamentos: [{
                id: paymentId,
                invoiceNumber,
                _type: 'ticket',
                status,
            }],
        },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status,
        metodoPagamento: method,
        paymentId,
        invoiceNumber,
        valorSelecionadoCentavos: { final: options.installmentPlan ? 1500 : 500 },
        ...(options.installmentPlan ? { installmentPlan: options.installmentPlan } : {}),
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: status === 'CONFIRMED' ? 'CONFIRMADA' : 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { final: options.installmentPlan ? 1500 : 500 },
        pagamento: { paymentId, invoiceNumber, metodo: method },
        ...(options.installmentPlan ? { installmentPlan: options.installmentPlan } : {}),
    });
    if (status === 'CONFIRMED') {
        await db.collection('pagamentos.comprovantes').insertOne({
            compraId: purchaseId,
            owner,
            status: 'PAID',
        });
    }
    return {
        purchaseId,
        owner,
        payment: {
            id: paymentId,
            invoiceNumber,
            customer,
            externalReference: String(purchaseId),
            value: options.installmentPlan ? 5 : 5,
            billingType: method,
            status: status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING',
            ...(options.installmentPlan
                ? { installment: String(options.installmentPlan.installmentId) }
                : {}),
        },
    };
}

test('readiness negativa nao fica presa no cache depois que o indice e criado', async () => {
    const db = client.db('webhook_tests');
    assert.equal(await ensureWebhookLedgerReady(db), false);
    await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).createIndex(
        { provider: 1, eventId: 1 },
        { name: WEBHOOK_EVENT_UNIQUE_INDEX, unique: true },
    );
    assert.equal(await ensureWebhookLedgerReady(db), true);
});

test('reproduz a projecao invalida e encontra exatamente o segundo pagamento com a correcao', async () => {
    const db = client.db('webhook_tests');
    const customer = 'cus_fixture';
    await db.collection('usuarios').insertOne({
        id_api: customer,
        pagamento: {
            situacao: 2,
            lista_pagamentos: [
                { id: 'pay_other', invoiceNumber: '111', _type: 'ticket' },
                { id: 'pay_expected', invoiceNumber: '878684585', _type: 'ticket' },
            ],
        },
    });

    await assert.rejects(
        db.collection('usuarios').findOne(
            { 'pagamento.lista_pagamentos': { $elemMatch: { invoiceNumber: '878684585' } } },
            {
                projection: {
                    'pagamento.lista_pagamentos': {
                        $elemMatch: { invoiceNumber: '878684585' },
                    },
                },
            },
        ),
        (error: { code?: number }) => error?.code === 31275,
    );

    const context = await findLegacyPaymentContext(db, {
        customer,
        id: 'pay_expected',
        invoiceNumber: '878684585',
    });

    assert.equal(context?.storedPayment.id, 'pay_expected');
    assert.equal(context?.storedPayment.invoiceNumber, '878684585');
});

test('quarentena um eventId legado sem criar v2 nem alterar o documento antigo', async () => {
    const db = await createLedgerIndexes();
    const oldId = new ObjectId();
    const oldDocument = {
        _id: oldId,
        provider: 'ASAAS',
        eventId: 'evt_legacy_r5',
        eventType: 'PAYMENT_CONFIRMED',
        status: 'FAILED',
        attempts: 1,
    };
    await db.collection(LEGACY_WEBHOOK_EVENTS_COLLECTION).insertOne(oldDocument);

    const result = await ingestWebhookEvent(db, {
        id: oldDocument.eventId,
        event: oldDocument.eventType,
        payment: { id: 'pay_fixture', value: 5 },
    });

    assert.deepEqual(result, { kind: 'legacy_quarantined', eventId: oldDocument.eventId });
    assert.equal(await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).countDocuments(), 0);
    assert.deepEqual(
        await db.collection(LEGACY_WEBHOOK_EVENTS_COLLECTION).findOne({ _id: oldId }),
        oldDocument,
    );
});

test('vinte entregas concorrentes criam um unico evento v2 e um unico claim', async () => {
    const db = await createLedgerIndexes();
    assert.equal(await ensureWebhookLedgerReady(db), true);
    const payload = {
        id: 'evt_parallel',
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_parallel' },
    };

    const results = await Promise.all(
        Array.from({ length: 20 }, () => ingestWebhookEvent(db, payload)),
    );
    assert.equal(results.filter((result) => result.kind === 'accepted').length, 1);
    assert.equal(results.filter((result) => result.kind === 'duplicate').length, 19);
    assert.equal(await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).countDocuments(), 1);

    const claims = await Promise.all(
        Array.from({ length: 20 }, () => claimWebhookEvent(db)),
    );
    assert.equal(claims.filter(Boolean).length, 1);
    const claimed = claims.find(Boolean);
    assert.equal(claimed?.attempts, 1);
    await finishWebhookEvent(db, claimed!._id, 'PROCESSED');
    assert.equal(
        (await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).findOne({ _id: claimed!._id }))?.status,
        'PROCESSED',
    );
});

test('FAILED volta ao mesmo documento e incrementa attempts depois do backoff', async () => {
    const db = await createLedgerIndexes();
    const ingestion = await ingestWebhookEvent(db, {
        id: 'evt_retry',
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_retry' },
    });
    assert.equal(ingestion.kind, 'accepted');
    if (ingestion.kind !== 'accepted') return;

    const first = await claimWebhookEvent(db, ingestion.ledgerId);
    assert.ok(first);
    assert.equal(await failWebhookEvent(db, first, new Error('falha injetada')), 'FAILED');
    await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
        { _id: ingestion.ledgerId },
        { $set: { nextAttemptAt: new Date(0) } },
    );
    const second = await claimWebhookEvent(db, ingestion.ledgerId);
    assert.ok(second);
    assert.equal(second.attempts, 2);
    assert.equal(await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).countDocuments(), 1);
});

test('uma falha no meio da transacao reverte todas as mutacoes financeiras', async () => {
    const db = client.db('webhook_tests');
    const purchaseId = new ObjectId();
    await db.collection('pagamentos.sessoes').insertOne({ _id: purchaseId, status: 'PAYMENT_PENDING' });
    await db.collection('pagamentos.atribuicoes').insertOne({ compraId: purchaseId, status: 'PAGAMENTO_PENDENTE' });

    await assert.rejects(
        runPaymentTransaction(client, async (session) => {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: purchaseId },
                { $set: { status: 'CONFIRMED' } },
                { session },
            );
            await db.collection('pagamentos.atribuicoes').updateOne(
                { compraId: purchaseId },
                { $set: { status: 'CONFIRMADA' } },
                { session },
            );
            throw new Error('falha injetada');
        }),
        /falha injetada/,
    );

    assert.equal((await db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }))?.status, 'PAYMENT_PENDING');
    assert.equal((await db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }))?.status, 'PAGAMENTO_PENDENTE');
});

test('PAYMENT_CONFIRMED valida e confirma atomicamente sessao, usuario, atribuicao e comprovante', async () => {
    const db = client.db('webhook_tests');
    process.env.MONGODB_URI = replicaSet.getUri();
    process.env.MONGODB_DB = 'webhook_tests';
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    const paymentId = 'pay_confirmed_fixture';
    const invoiceNumber = '878684585';
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: 'cus_confirmed_fixture',
        pagamento: {
            situacao: 2,
            lista_pagamentos: [
                { id: paymentId, invoiceNumber, _type: 'ticket', status: 'PENDING' },
            ],
        },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status: 'PAYMENT_PENDING',
        metodoPagamento: 'CREDIT_CARD',
        paymentId,
        invoiceNumber,
        activeKey: `CIEPS-2026:${owner}`,
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { final: 500 },
        pagamento: { paymentId, invoiceNumber, metodo: 'CREDIT_CARD' },
    });
    const payload = {
        id: 'evt_confirmed_fixture',
        event: 'PAYMENT_CONFIRMED',
        payment: {
            id: paymentId,
            invoiceNumber,
            customer: 'cus_confirmed_fixture',
            externalReference: String(purchaseId),
            value: 5,
            billingType: 'CREDIT_CARD',
            status: 'CONFIRMED',
        },
    };

    const result = await runPaymentTransaction(
        client,
        (session) => processEvent(db, payload, session),
    );

    assert.equal(result.requiresReview, false);
    const [paymentSession, user, assignment, receipt] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }),
        db.collection('usuarios').findOne({ _id: owner }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }),
        db.collection('pagamentos.comprovantes').findOne({ compraId: purchaseId }),
    ]);
    assert.equal(paymentSession?.status, 'CONFIRMED');
    assert.equal(paymentSession?.activeKey, undefined);
    assert.equal(user?.pagamento?.situacao, 1);
    assert.equal(String(user?.pagamento?.compraId), String(purchaseId));
    assert.equal(user?.pagamento?.lista_pagamentos?.[0]?.status, 'PAYMENT_CONFIRMED');
    assert.equal(assignment?.status, 'CONFIRMADA');
    assert.equal(receipt?.status, 'PAID');
});

test('divergencia do desconto nao apaga a verdade financeira da confirmacao', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    const paymentId = 'pay_discount_review';
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: 'cus_discount_review',
        pagamento: {
            situacao: 2,
            lista_pagamentos: [{ id: paymentId, invoiceNumber: 'discount-1', _type: 'ticket' }],
        },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status: 'PAYMENT_PENDING',
        metodoPagamento: 'PIX',
        paymentId,
        invoiceNumber: 'discount-1',
        codigoDesconto: { codigoId: new ObjectId() },
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { final: 500 },
        pagamento: { paymentId },
    });

    const result = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_discount_review',
        event: 'PAYMENT_RECEIVED',
        payment: {
            id: paymentId,
            invoiceNumber: 'discount-1',
            customer: 'cus_discount_review',
            externalReference: String(purchaseId),
            value: 5,
            billingType: 'PIX',
            status: 'RECEIVED',
        },
    }, session));

    assert.equal(result.requiresReview, true);
    assert.equal(result.reviewReason, 'DISCOUNT_CONSUMPTION_MISMATCH');
    assert.equal(
        (await db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }))?.status,
        'CONFIRMED',
    );
    assert.equal(
        (await db.collection('usuarios').findOne({ _id: owner }))?.pagamento?.situacao,
        1,
    );
    assert.equal(
        (await db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }))?.status,
        'CONFIRMADA',
    );
});

test('valor divergente vai para revisao sem liberar acesso nem confirmar atribuicao', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: 'cus_value_mismatch',
        pagamento: {
            situacao: 2,
            lista_pagamentos: [
                { id: 'pay_value_mismatch', invoiceNumber: '222', _type: 'ticket' },
            ],
        },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status: 'PAYMENT_PENDING',
        metodoPagamento: 'PIX',
        paymentId: 'pay_value_mismatch',
        invoiceNumber: '222',
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { final: 500 },
        pagamento: { paymentId: 'pay_value_mismatch' },
    });

    const result = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_value_mismatch',
        event: 'PAYMENT_RECEIVED',
        payment: {
            id: 'pay_value_mismatch',
            invoiceNumber: '222',
            customer: 'cus_value_mismatch',
            externalReference: String(purchaseId),
            value: 4.99,
            billingType: 'PIX',
            status: 'RECEIVED',
        },
    }, session));

    assert.equal(result.requiresReview, true);
    assert.equal(
        (await db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }))?.status,
        'PAYMENT_REVIEW_REQUIRED',
    );
    assert.equal(
        (await db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }))?.status,
        'PAGAMENTO_PENDENTE',
    );
    assert.equal(
        (await db.collection('usuarios').findOne({ _id: owner }))?.pagamento?.situacao,
        2,
    );
});

test('atribuicao sem sessao fica em revisao e nao e confirmada pelo caminho legado', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        pagamento: { paymentId: 'pay_orphan_fixture' },
    });
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: 'cus_orphan_fixture',
        pagamento: {
            situacao: 1,
            lista_pagamentos: [
                { id: 'pay_orphan_fixture', invoiceNumber: '333', _type: 'ticket' },
            ],
        },
    });

    const result = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_orphan_fixture',
        event: 'PAYMENT_CONFIRMED',
        payment: {
            id: 'pay_orphan_fixture',
            invoiceNumber: '333',
            customer: 'cus_orphan_fixture',
            externalReference: String(purchaseId),
            value: 5,
            billingType: 'CREDIT_CARD',
            status: 'CONFIRMED',
        },
    }, session));

    assert.equal(result.requiresReview, true);
    assert.equal(result.reviewReason, 'SESSION_MISSING_FOR_ASSIGNMENT');
    assert.equal(
        (await db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }))?.status,
        'PAGAMENTO_PENDENTE',
    );
});

test('handler recusa webhook sem configuracao ou token e aceita somente o header oficial', async () => {
    process.env.MONGODB_URI = replicaSet.getUri();
    process.env.MONGODB_DB = 'webhook_tests';
    process.env.ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3';
    const { POST, handleAsaasWebhookRequest } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const { derivePaymentCredential } = await import('../../webhook-auth.ts');
    const previousRoot = process.env.PAYMENT_RECONCILIATION_SECRET;

    try {
        delete process.env.PAYMENT_RECONCILIATION_SECRET;
        const unconfigured = await POST(new Request('http://localhost/webhook', {
            method: 'POST',
            body: '{}',
        }));
        assert.equal(unconfigured.status, 503);

        process.env.PAYMENT_RECONCILIATION_SECRET = '0123456789abcdef0123456789abcdef';
        const missing = await POST(new Request('http://localhost/webhook', {
            method: 'POST',
            body: '{}',
        }));
        const unofficial = await POST(new Request('http://localhost/webhook', {
            method: 'POST',
            headers: { 'x-webhook-token': derivePaymentCredential('webhook')! },
            body: '{}',
        }));
        const wrong = await POST(new Request('http://localhost/webhook', {
            method: 'POST',
            headers: { 'asaas-access-token': 'wrong-token' },
            body: '{}',
        }));
        assert.equal(missing.status, 401);
        assert.equal(unofficial.status, 401);
        assert.equal(wrong.status, 401);

        const authorized = await POST(new Request('http://localhost/webhook', {
            method: 'POST',
            headers: { 'asaas-access-token': derivePaymentCredential('webhook')! },
            body: '{invalid-json',
        }));
        assert.equal(authorized.status, 400);

        const db = await createLedgerIndexes();
        clearWebhookLedgerReadinessCache();
        const scheduled: Array<() => unknown> = [];
        const accepted = await handleAsaasWebhookRequest(
            new Request('http://localhost/webhook', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'asaas-access-token': derivePaymentCredential('webhook')!,
                },
                body: JSON.stringify({
                    id: 'evt_handler_accepted',
                    event: 'PAYMENT_CONFIRMED',
                    payment: { id: 'pay_handler_accepted' },
                }),
            }),
            (callback: () => unknown) => scheduled.push(callback),
            async () => ({ db, client }),
        );
        assert.equal(accepted.status, 200);
        assert.equal(scheduled.length, 1);
        assert.equal(
            (await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).findOne({
                eventId: 'evt_handler_accepted',
            }))?.status,
            'PENDING',
        );
    } finally {
        if (previousRoot === undefined) delete process.env.PAYMENT_RECONCILIATION_SECRET;
        else process.env.PAYMENT_RECONCILIATION_SECRET = previousRoot;
    }
});

test('troca PIX cancelada no Asaas cria uma unica sessao de cartao e transfere a reserva', async () => {
    const db = client.db('webhook_tests');
    const owner = new ObjectId();
    const purchaseId = new ObjectId();
    const codeId = new ObjectId();
    const values = {
        original: { PIX: 500, CREDIT_CARD: 500, BOLETO: 500, DEBIT_CARD: 500 },
        desconto: { PIX: 100, CREDIT_CARD: 100, BOLETO: 100, DEBIT_CARD: 100 },
        final: { PIX: 400, CREDIT_CARD: 400, BOLETO: 400, DEBIT_CARD: 400 },
    };
    const discount = { codigoId: codeId, codigo: 'TESTE', codigoNormalizado: 'TESTE', tipo: 'DESCONTO', percentualDesconto: 20 };
    await Promise.all([
        db.collection('pagamentos.sessoes').insertOne({
            _id: purchaseId,
            activeKey: `CIEPS-2026:${owner.toHexString()}:ticket`,
            owner,
            edicaoId: 'CIEPS-2026',
            type: 'ticket',
            status: 'PAYMENT_PENDING',
            metodoPagamento: 'PIX',
            orderId: 'checkout_switch',
            paymentUrl: 'https://sandbox.asaas.com/checkout',
            expiresAt: new Date(Date.now() - 60_000),
            metodosPagamentoPermitidos: ['PIX', 'CREDIT_CARD'],
            paymentConfig: { nome: 'Lote teste', precos: { parcelamentos: [] } },
            paymentConfigOriginal: { nome: 'Lote teste', precos: { parcelamentos: [] } },
            valoresCentavos: values,
            codigoDesconto: discount,
            codigoRastreio: { codigo: 'RASTREIO', tipo: 'RASTREIO' },
            userProps: { name: 'Teste' },
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        db.collection('pagamentos.atribuicoes').insertOne({
            compraId: purchaseId,
            edicaoId: 'CIEPS-2026',
            usuarioId: owner,
            valoresCentavos: values,
            status: 'PAGAMENTO_PENDENTE',
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        db.collection('pagamentos.codigos').insertOne({
            _id: codeId,
            tipo: 'DESCONTO',
            status: 'RESERVADO',
            reserva: { compraId: purchaseId, usuarioId: owner, cobrancaExternaCriada: true, reservadoAte: null },
        }),
        db.collection('usuarios').insertOne({ _id: owner, pagamento: { situacao: 2 } }),
    ]);
    let cancelCalls = 0;
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
            cancelCalls += 1;
            return Response.json({ status: 'CANCELED' });
        }
        return Response.json({ data: [] });
    }) as typeof fetch;

    const result = await switchPixSessionToCreditCard({
        db,
        client,
        owner,
        sessionId: purchaseId,
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'fixture-key',
        fetcher,
    });
    assert.equal(result.kind, 'completed');
    assert.equal(cancelCalls, 1);
    const replacementId = result.kind === 'completed' ? result.session._id as ObjectId : null;
    const [oldSession, replacement, code, assignments] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }),
        db.collection('pagamentos.sessoes').findOne({ _id: replacementId }),
        db.collection('pagamentos.codigos').findOne({ _id: codeId }),
        db.collection('pagamentos.atribuicoes').find({ usuarioId: owner }).toArray(),
    ]);
    assert.equal(oldSession?.status, 'CANCELLED');
    assert.equal(replacement?.status, 'OPEN');
    assert.equal(replacement?.metodoPagamento, 'CREDIT_CARD');
    assert.deepEqual(replacement?.valoresCentavos, values);
    assert.equal(String(code?.reserva?.compraId), String(replacementId));
    assert.deepEqual(assignments.map((item) => item.status).sort(), ['ABERTA', 'CANCELADA']);
});

test('timeout ao cancelar PIX preserva sessao, vaga e desconto', async () => {
    const db = client.db('webhook_tests');
    const owner = new ObjectId();
    const purchaseId = new ObjectId();
    await Promise.all([
        db.collection('pagamentos.sessoes').insertOne({
            _id: purchaseId,
            owner,
            edicaoId: 'CIEPS-2026',
            type: 'ticket',
            status: 'PAYMENT_PENDING',
            metodoPagamento: 'PIX',
            orderId: 'checkout_timeout',
            expiresAt: new Date(Date.now() - 60_000),
            metodosPagamentoPermitidos: ['PIX', 'CREDIT_CARD'],
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        db.collection('pagamentos.atribuicoes').insertOne({ compraId: purchaseId, usuarioId: owner, status: 'PAGAMENTO_PENDENTE' }),
        db.collection('pagamentos.codigos').insertOne({ tipo: 'DESCONTO', status: 'RESERVADO', reserva: { compraId: purchaseId } }),
    ]);
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') throw new Error('timeout');
        return Response.json({ data: [] });
    }) as typeof fetch;
    const result = await switchPixSessionToCreditCard({
        db,
        client,
        owner,
        sessionId: purchaseId,
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'fixture-key',
        fetcher,
    });
    const [session, assignment, code, replacementCount] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }),
        db.collection('pagamentos.codigos').findOne({ 'reserva.compraId': purchaseId }),
        db.collection('pagamentos.sessoes').countDocuments({ previousSessionId: purchaseId }),
    ]);
    assert.equal(result.kind, 'pending');
    assert.equal(session?.status, 'PAYMENT_PENDING');
    assert.equal(session?.paymentMethodSwitch?.status, 'RETRYABLE');
    assert.equal(assignment?.status, 'PAGAMENTO_PENDENTE');
    assert.equal(code?.status, 'RESERVADO');
    assert.equal(replacementCount, 0);
});

test('migracao index-only exige digest e preserva ledger legado e pagamento protegido', async () => {
    const db = client.db('webhook_tests');
    const protectedEventId = 'evt_protected_fixture';
    const paymentId = 'pay_protected_fixture';
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    await db.collection('ingressos_config').insertOne({
        edicaoId: 'CIEPS-2026',
        ativo: true,
    });
    await db.collection(LEGACY_WEBHOOK_EVENTS_COLLECTION).insertMany([
        {
            provider: 'ASAAS', eventId: protectedEventId, eventType: 'PAYMENT_CONFIRMED',
            paymentId, status: 'FAILED', attempts: 1,
        },
        {
            provider: 'ASAAS', eventId: protectedEventId, eventType: 'PAYMENT_CONFIRMED',
            paymentId, status: 'PROCESSING', attempts: 1,
        },
    ]);
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        pagamento: { paymentId },
    });
    await db.collection('usuarios').insertOne({
        _id: owner,
        pagamento: {
            situacao: 1,
            lista_pagamentos: [{ id: paymentId, value: 5 }],
        },
    });
    const legacyBefore = await db.collection(LEGACY_WEBHOOK_EVENTS_COLLECTION)
        .find({}).sort({ _id: 1 }).toArray();
    const userBefore = await db.collection('usuarios').findOne({ _id: owner });
    const assignmentBefore = await db.collection('pagamentos.atribuicoes')
        .findOne({ compraId: purchaseId });
    const commonArgs = [
        'scripts/migrations/setup-payment-indexes.mjs',
        '--database', 'webhook_tests',
        '--edition', 'CIEPS-2026',
        '--protect-event', protectedEventId,
    ];
    const environment = {
        ...process.env,
        MONGODB_URI: replicaSet.getUri(),
        MONGODB_DB: 'webhook_tests',
    };

    const dryRun = await execFileAsync(process.execPath, commonArgs, {
        cwd: process.cwd(),
        env: environment,
    });
    const preflight = JSON.parse(dryRun.stdout);
    assert.equal(preflight.mode, 'dry-run');
    assert.equal(preflight.legacySnapshot.count, 2);
    assert.equal(preflight.protectedFinancial.documentCounts.users, 1);

    await execFileAsync(process.execPath, [
        ...commonArgs,
        '--apply',
        '--confirm', preflight.digest,
    ], {
        cwd: process.cwd(),
        env: environment,
    });

    const indexes = await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).listIndexes().toArray();
    assert.equal(indexes.some((index) => index.name === WEBHOOK_EVENT_UNIQUE_INDEX), true);
    assert.deepEqual(
        await db.collection(LEGACY_WEBHOOK_EVENTS_COLLECTION).find({}).sort({ _id: 1 }).toArray(),
        legacyBefore,
    );
    assert.deepEqual(await db.collection('usuarios').findOne({ _id: owner }), userBefore);
    assert.deepEqual(
        await db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }),
        assignmentBefore,
    );
});

test('atividade vencida mantem participante e confirmacao tardia o reinsere', async () => {
    const db = client.db('webhook_tests');
    const { updateLegacyPayment } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const userId = new ObjectId();
    const activityId = new ObjectId();
    const payment = {
        id: 'pay_activity_fixture',
        invoiceNumber: 'activity-444',
        customer: 'cus_activity_fixture',
        status: 'OVERDUE',
    };
    await db.collection('usuarios').insertOne({
        _id: userId,
        id_api: payment.customer,
        pagamento: {
            lista_pagamentos: [{
                id: payment.id,
                invoiceNumber: payment.invoiceNumber,
                _type: 'activity',
                _eventID: String(activityId),
                _userId: userId,
            }],
        },
    });
    await db.collection('minicursos').insertOne({ _id: activityId, participants: [userId] });

    await runPaymentTransaction(client, (session) => updateLegacyPayment(db, {
        id: 'evt_activity_overdue', event: 'PAYMENT_OVERDUE', payment,
    }, session));
    assert.equal(
        (await db.collection('minicursos').findOne({ _id: activityId }))?.participants.length,
        1,
    );

    await db.collection<{ _id: ObjectId; participants: ObjectId[] }>('minicursos').updateOne(
        { _id: activityId },
        { $pull: { participants: userId } },
    );
    await runPaymentTransaction(client, (session) => updateLegacyPayment(db, {
        id: 'evt_activity_confirmed',
        event: 'PAYMENT_CONFIRMED',
        payment: { ...payment, status: 'CONFIRMED' },
    }, session));
    assert.equal(
        (await db.collection('minicursos').findOne({ _id: activityId }))?.participants.length,
        1,
    );

    await runPaymentTransaction(client, (session) => updateLegacyPayment(db, {
        id: 'evt_activity_deleted',
        event: 'PAYMENT_DELETED',
        payment: { ...payment, status: 'DELETED' },
    }, session));
    assert.equal(
        (await db.collection('minicursos').findOne({ _id: activityId }))?.participants.length,
        0,
    );
});

test('estorno tardio de uma edicao nao sobrescreve a compra atual do usuario', async () => {
    const db = client.db('webhook_tests');
    const owner = new ObjectId();
    const refundedPurchaseId = new ObjectId();
    const currentPurchaseId = new ObjectId();
    await db.collection('usuarios').insertOne({
        _id: owner,
        pagamento: {
            situacao: 1,
            edicaoId: 'CIEPS-2027',
            compraId: currentPurchaseId,
        },
    });

    await runPaymentTransaction(client, (session) => updateUserRegistrationAfterRefund(
        db,
        owner,
        'CIEPS-2026',
        refundedPurchaseId,
        session,
    ));

    const user = await db.collection('usuarios').findOne({ _id: owner });
    assert.equal(user?.pagamento?.situacao, 1);
    assert.equal(user?.pagamento?.edicaoId, 'CIEPS-2027');
    assert.equal(String(user?.pagamento?.compraId), String(currentPurchaseId));
});

test('lista oficial inclui todos os eventos financeiros automatizados ou revisados', async () => {
    const { OFFICIAL_RELEVANT_PAYMENT_EVENTS, OFFICIAL_RELEVANT_CHECKOUT_EVENTS } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    for (const event of [
        'PAYMENT_CREATED',
        'PAYMENT_REFUND_DENIED',
        'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
        'PAYMENT_RECEIVED_IN_CASH_UNDONE',
        'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
        'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
    ]) assert.ok(OFFICIAL_RELEVANT_PAYMENT_EVENTS.includes(event));
    assert.ok(OFFICIAL_RELEVANT_CHECKOUT_EVENTS.includes('CHECKOUT_CREATED'));
});

test('snapshot de refunds soma somente DONE e refund negado encerra IN_PROGRESS em revisao', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const seeded = await seedModernPayment(db, { status: 'CONFIRMED' });
    const refunds = [
        { value: 1.25, status: 'DONE', dateCreated: '2026-08-08', transactionReceiptUrl: 'https://receipt/1' },
        { value: 0.5, status: 'PENDING', dateCreated: '2026-08-09', transactionReceiptUrl: null },
        { value: 0.25, status: 'CANCELLED', dateCreated: '2026-08-10', transactionReceiptUrl: null },
    ];
    await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_refund_progress', event: 'PAYMENT_REFUND_IN_PROGRESS',
        payment: { ...seeded.payment, status: 'CONFIRMED', refunds },
    }, session));
    const denied = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_refund_denied', event: 'PAYMENT_REFUND_DENIED',
        payment: { ...seeded.payment, status: 'CONFIRMED', refunds },
    }, session));
    assert.equal(denied.requiresReview, true);
    const [paymentSession, assignment, user] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: seeded.purchaseId }),
        db.collection('usuarios').findOne({ _id: seeded.owner }),
    ]);
    assert.equal(paymentSession?.refundsSnapshot?.items.length, 3);
    assert.equal(paymentSession?.refundsSnapshot?.totalDoneCentavos, 125);
    assert.equal(assignment?.refundsSnapshot?.totalDoneCentavos, 125);
    assert.equal(paymentSession?.refundStatus, 'PARTIAL');
    assert.equal(paymentSession?.refundAttemptStatus, 'DENIED');
    assert.equal(user?.pagamento?.situacao, 1);
});

test('chargeback ganho aguarda reversao e confirmacao posterior limpa o estado', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const seeded = await seedModernPayment(db, { status: 'CONFIRMED' });
    for (const event of [
        'PAYMENT_CHARGEBACK_REQUESTED',
        'PAYMENT_CHARGEBACK_DISPUTE',
        'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
    ]) {
        await runPaymentTransaction(client, (session) => processEvent(db, {
            id: `evt_${event}`, event,
            payment: { ...seeded.payment, status: 'CONFIRMED' },
        }, session));
    }
    assert.equal(
        (await db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }))
            ?.chargebackStatus,
        'AWAITING_REVERSAL',
    );
    const resolved = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_chargeback_won', event: 'PAYMENT_RECEIVED',
        payment: { ...seeded.payment, status: 'RECEIVED' },
    }, session));
    assert.equal(resolved.requiresReview, false);
    const [paymentSession, assignment] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: seeded.purchaseId }),
    ]);
    assert.equal(paymentSession?.chargebackStatus, undefined);
    assert.equal(assignment?.chargebackStatus, undefined);
    assert.equal(paymentSession?.chargebackResolution, 'WON');
});

test('PIX CONFIRMED permanece pendente e somente PAYMENT_RECEIVED libera acesso', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const seeded = await seedModernPayment(db, { method: 'PIX' });
    const confirmed = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_pix_confirmed', event: 'PAYMENT_CONFIRMED',
        payment: { ...seeded.payment, billingType: 'PIX', status: 'CONFIRMED' },
    }, session));
    assert.equal(confirmed.requiresReview, false);
    assert.equal(
        (await db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }))?.status,
        'PAYMENT_PENDING',
    );
    assert.equal((await db.collection('usuarios').findOne({ _id: seeded.owner }))?.pagamento?.situacao, 2);
    await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_pix_received', event: 'PAYMENT_RECEIVED',
        payment: { ...seeded.payment, billingType: 'PIX', status: 'RECEIVED' },
    }, session));
    assert.equal(
        (await db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }))?.status,
        'CONFIRMED',
    );
    assert.equal((await db.collection('usuarios').findOne({ _id: seeded.owner }))?.pagamento?.situacao, 1);
});

test('parcelamento 3x aceita novos paymentIds e refund de uma parcela nao revoga inscricao', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const installmentPlan = {
        installmentId: 'ins_three_parts', count: 3,
        totalValueCentavos: 1500, installmentValueCentavos: 500, observedPayments: [],
    };
    const seeded = await seedModernPayment(db, { installmentPlan });
    await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_installment_1', event: 'PAYMENT_CONFIRMED',
        payment: { ...seeded.payment, installmentNumber: 1, status: 'CONFIRMED' },
    }, session));
    const secondPayment = {
        ...seeded.payment,
        id: 'pay_installment_second', invoiceNumber: 'inv_installment_second',
        installmentNumber: 2, status: 'RECEIVED',
    };
    const second = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_installment_2', event: 'PAYMENT_RECEIVED', payment: secondPayment,
    }, session));
    assert.equal(second.requiresReview, false);
    const refund = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_installment_refund_2', event: 'PAYMENT_REFUNDED',
        payment: {
            ...secondPayment,
            status: 'REFUNDED',
            refunds: [{
                value: 5, status: 'DONE', dateCreated: '2026-08-08',
                transactionReceiptUrl: 'https://receipt/installment-2',
            }],
        },
    }, session));
    assert.equal(refund.requiresReview, true);
    const [paymentSession, assignment, user] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: seeded.purchaseId }),
        db.collection('usuarios').findOne({ _id: seeded.owner }),
    ]);
    assert.equal(paymentSession?.status, 'CONFIRMED');
    assert.equal(assignment?.status, 'CONFIRMADA');
    assert.equal(user?.pagamento?.situacao, 1);
    assert.equal(paymentSession?.installmentPlan?.observedPayments.length, 2);
    assert.equal(paymentSession?.installmentPlan?.refundTotalDoneCentavos, 500);
    assert.equal(paymentSession?.refundsSnapshot?.totalDoneCentavos, 500);
});

test('webhook antes da resposta hidrata plano provisório e confirma a parcela correta', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    const customer = `cus_${owner.toHexString()}`;
    const provisionalPlan = {
        installmentId: null,
        count: 3,
        totalValueCentavos: 1500,
        installmentValueCentavos: 500,
        observedPayments: [],
    };
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: customer,
        pagamento: { situacao: 2, lista_pagamentos: [] },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status: 'CREATING_PAYMENT',
        metodoPagamento: 'CREDIT_CARD',
        valorSelecionadoCentavos: { original: 1500, desconto: 0, final: 1500 },
        installmentPlan: provisionalPlan,
        activeKey: `CIEPS-2026:${owner}:ticket`,
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { original: 1500, desconto: 0, final: 1500 },
        installmentPlan: provisionalPlan,
        pagamento: { metodo: 'CREDIT_CARD' },
    });
    const payload = {
        id: 'evt_installment_before_response',
        event: 'PAYMENT_CONFIRMED',
        payment: {
            id: 'pay_installment_before_response',
            invoiceNumber: 'inv_installment_before_response',
            installment: 'ins_before_response',
            installmentNumber: 1,
            customer,
            externalReference: String(purchaseId),
            value: 5,
            billingType: 'CREDIT_CARD',
            status: 'CONFIRMED',
        },
    };

    const result = await runPaymentTransaction(
        client,
        (session) => processEvent(db, payload, session),
    );

    assert.equal(result.requiresReview, false);
    const [paymentSession, assignment, user] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }),
        db.collection('usuarios').findOne({ _id: owner }),
    ]);
    assert.equal(paymentSession?.status, 'CONFIRMED');
    assert.equal(paymentSession?.installmentPlan?.installmentId, 'ins_before_response');
    assert.equal(paymentSession?.installmentPlan?.observedPayments?.[0]?.paymentId,
        'pay_installment_before_response');
    assert.equal(assignment?.status, 'CONFIRMADA');
    assert.equal(assignment?.installmentPlan?.installmentId, 'ins_before_response');
    assert.equal(user?.pagamento?.situacao, 1);
});

test('webhook de outro customer nao envenena o identificador do plano provisorio', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    const provisionalPlan = {
        installmentId: null,
        count: 3,
        totalValueCentavos: 1500,
        installmentValueCentavos: 500,
        observedPayments: [],
    };
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: `cus_${owner.toHexString()}`,
        pagamento: { situacao: 2, lista_pagamentos: [] },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status: 'CREATING_PAYMENT',
        metodoPagamento: 'CREDIT_CARD',
        valorSelecionadoCentavos: { final: 1500 },
        installmentPlan: provisionalPlan,
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { final: 1500 },
        installmentPlan: provisionalPlan,
        pagamento: { metodo: 'CREDIT_CARD' },
    });

    const result = await runPaymentTransaction(
        client,
        (session) => processEvent(db, {
            id: 'evt_wrong_customer_before_response',
            event: 'PAYMENT_CREATED',
            payment: {
                id: 'pay_wrong_customer',
                invoiceNumber: 'inv_wrong_customer',
                installment: 'ins_wrong_customer',
                installmentNumber: 1,
                customer: 'cus_other_customer',
                externalReference: String(purchaseId),
                value: 5,
                billingType: 'CREDIT_CARD',
                status: 'PENDING',
            },
        }, session),
    );

    assert.equal(result.requiresReview, true);
    assert.equal(result.reviewReason, 'PAYMENT_CUSTOMER_MISMATCH');
    const [paymentSession, assignment] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }),
    ]);
    assert.equal(paymentSession?.installmentPlan?.installmentId, null);
    assert.equal(assignment?.installmentPlan?.installmentId, null);
    assert.equal(paymentSession?.paymentId, undefined);
    assert.equal(assignment?.pagamento?.paymentId, undefined);
});

test('referencia cruzada e CHECKOUT_CREATED divergente nao alteram outra compra', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const seeded = await seedModernPayment(db);
    const crossed = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_crossed_reference', event: 'PAYMENT_CONFIRMED',
        payment: { ...seeded.payment, externalReference: String(new ObjectId()), status: 'CONFIRMED' },
    }, session));
    assert.equal(crossed.requiresReview, true);
    assert.equal((await db.collection('usuarios').findOne({ _id: seeded.owner }))?.pagamento?.situacao, 2);

    const checkout = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_checkout_crossed', event: 'CHECKOUT_CREATED',
        checkout: {
            id: 'checkout_crossed', externalReference: String(new ObjectId()), link: 'https://checkout',
        },
        payment: { id: seeded.payment.id },
    }, session));
    assert.equal(checkout.requiresReview, true);
    assert.equal(
        (await db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }))?.orderId,
        undefined,
    );
});

test('CHECKOUT_CREATED recupera resposta PIX perdida sem liberar acesso', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const seeded = await seedModernPayment(db, { method: 'PIX' });
    await db.collection('pagamentos.sessoes').updateOne(
        { _id: seeded.purchaseId },
        { $set: { status: 'CREATING_PAYMENT' }, $unset: { paymentId: '', invoiceNumber: '' } },
    );
    const result = await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_checkout_recovered', event: 'CHECKOUT_CREATED',
        checkout: {
            id: 'checkout_recovered', externalReference: String(seeded.purchaseId),
            link: 'https://checkout/recovered',
        },
    }, session));
    assert.equal(result.requiresReview, false);
    const [paymentSession, assignment, user] = await Promise.all([
        db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
        db.collection('pagamentos.atribuicoes').findOne({ compraId: seeded.purchaseId }),
        db.collection('usuarios').findOne({ _id: seeded.owner }),
    ]);
    assert.equal(paymentSession?.status, 'PAYMENT_PENDING');
    assert.equal(paymentSession?.orderId, 'checkout_recovered');
    assert.equal(assignment?.pagamento?.checkoutId, 'checkout_recovered');
    assert.equal(user?.pagamento?.situacao, 2);
});

test('worker global ignora ledgerId tardio e processa confirmacao antes do refund', async () => {
    const db = await createLedgerIndexes();
    process.env.MONGODB_URI = replicaSet.getUri();
    process.env.MONGODB_DB = 'webhook_tests';
    const { processAcceptedWebhookEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const seeded = await seedModernPayment(db);
    const confirmation = await ingestWebhookEvent(db, {
        id: 'evt_fifo_confirmation', event: 'PAYMENT_CONFIRMED',
        payment: { ...seeded.payment, status: 'CONFIRMED' },
    });
    const refund = await ingestWebhookEvent(db, {
        id: 'evt_fifo_refund', event: 'PAYMENT_REFUNDED',
        payment: {
            ...seeded.payment,
            status: 'REFUNDED',
            refunds: [{ value: 5, status: 'DONE', dateCreated: '2026-08-08', transactionReceiptUrl: null }],
        },
    });
    assert.equal(confirmation.kind, 'accepted');
    assert.equal(refund.kind, 'accepted');
    if (confirmation.kind !== 'accepted' || refund.kind !== 'accepted') return;
    await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
        { _id: confirmation.ledgerId },
        { $set: { receivedAt: new Date('2026-08-08T10:00:00Z') } },
    );
    await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
        { _id: refund.ledgerId },
        { $set: { receivedAt: new Date('2026-08-08T10:00:01Z') } },
    );
    await processAcceptedWebhookEvent(refund.ledgerId);
    const paymentSession = await db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId });
    assert.equal(paymentSession?.status, 'REFUNDED');
    assert.ok(paymentSession?.confirmedAt instanceof Date);
    assert.deepEqual(
        await db.collection(WEBHOOK_EVENTS_V2_COLLECTION)
            .find({}).sort({ receivedAt: 1 }).project({ status: 1 }).toArray()
            .then((rows) => rows.map((row) => row.status)),
        ['PROCESSED', 'PROCESSED'],
    );
});

test('falha FIFO segura o evento posterior ate retry ou REVIEW_REQUIRED', async () => {
    const db = await createLedgerIndexes();
    process.env.MONGODB_URI = replicaSet.getUri();
    process.env.MONGODB_DB = 'webhook_tests';
    const previousApiUrl = process.env.ASAAS_API_URL;
    const previousApiKey = process.env.ASAAS_API_KEY;
    process.env.ASAAS_API_URL = 'http://127.0.0.1:1';
    process.env.ASAAS_API_KEY = 'fixture-key';
    try {
        const { processAcceptedWebhookEvent } = await import(
            '../../../../api/payment/webhook/payment_notification/route.js'
        );
        const first = await ingestWebhookEvent(db, {
            id: 'evt_fifo_poison', event: 'CHECKOUT_PAID', checkout: { id: 'checkout_poison' },
        });
        const second = await ingestWebhookEvent(db, {
            id: 'evt_fifo_later', event: 'PAYMENT_UPDATED', payment: { id: 'pay_later' },
        });
        assert.equal(first.kind, 'accepted');
        assert.equal(second.kind, 'accepted');
        if (first.kind !== 'accepted' || second.kind !== 'accepted') return;
        await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
            { _id: first.ledgerId },
            { $set: { receivedAt: new Date('2026-08-08T10:00:00Z') } },
        );
        await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
            { _id: second.ledgerId },
            { $set: { receivedAt: new Date('2026-08-08T10:00:01Z') } },
        );
        const failed = await processAcceptedWebhookEvent(second.ledgerId);
        assert.equal(failed.failed, 1);
        assert.equal(
            (await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).findOne({ _id: second.ledgerId }))?.status,
            'PENDING',
        );
        const blocked = await processAcceptedWebhookEvent(second.ledgerId);
        assert.equal(blocked.reason, 'worker_busy');
        for (let attempt = 2; attempt <= 3; attempt += 1) {
            await db.collection<{ _id: string; leaseUntil?: Date }>(
                'pagamentos.webhook_worker_locks',
            ).updateOne(
                { _id: 'asaas-global-fifo' },
                { $set: { leaseUntil: new Date(0) } },
            );
            await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
                { _id: first.ledgerId },
                { $set: { nextAttemptAt: new Date(0) } },
            );
            await processAcceptedWebhookEvent(second.ledgerId);
        }
        assert.equal(
            (await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).findOne({ _id: first.ledgerId }))?.status,
            'REVIEW_REQUIRED',
        );
        assert.equal(
            (await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).findOne({ _id: second.ledgerId }))?.status,
            'PROCESSED',
        );
    } finally {
        if (previousApiUrl === undefined) delete process.env.ASAAS_API_URL;
        else process.env.ASAAS_API_URL = previousApiUrl;
        if (previousApiKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = previousApiKey;
    }
});

test('eventos excepcionais nunca liberam acesso silenciosamente', async () => {
    const db = client.db('webhook_tests');
    const { processEvent } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    const captureRefused = await seedModernPayment(db);
    const restored = await seedModernPayment(db, { status: 'CONFIRMED' });
    const cashUndone = await seedModernPayment(db, { status: 'CONFIRMED' });
    const riskRejected = await seedModernPayment(db, { status: 'CONFIRMED' });

    await runPaymentTransaction(client, (session) => processEvent(db, {
        id: 'evt_capture_refused',
        event: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
        payment: { ...captureRefused.payment, status: 'PENDING' },
    }, session));
    for (const [id, event, seeded] of [
        ['evt_restored_review', 'PAYMENT_RESTORED', restored],
        ['evt_cash_undone_review', 'PAYMENT_RECEIVED_IN_CASH_UNDONE', cashUndone],
        ['evt_risk_review', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS', riskRejected],
    ] as const) {
        const result = await runPaymentTransaction(client, (session) => processEvent(db, {
            id,
            event,
            payment: { ...seeded.payment, status: 'CONFIRMED' },
        }, session));
        assert.equal(result.requiresReview, true);
    }

    const refusedSession = await db.collection('pagamentos.sessoes').findOne({
        _id: captureRefused.purchaseId,
    });
    assert.equal(refusedSession?.status, 'CANCELLED');
    assert.equal(
        (await db.collection('usuarios').findOne({ _id: captureRefused.owner }))?.pagamento?.situacao,
        0,
    );
    for (const [event, seeded] of [
        ['PAYMENT_RESTORED', restored],
        ['PAYMENT_RECEIVED_IN_CASH_UNDONE', cashUndone],
        ['PAYMENT_REPROVED_BY_RISK_ANALYSIS', riskRejected],
    ] as const) {
        const [paymentSession, user] = await Promise.all([
            db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
            db.collection('usuarios').findOne({ _id: seeded.owner }),
        ]);
        assert.equal(paymentSession?.status, 'CONFIRMED');
        assert.equal(paymentSession?.financialReviewEvent, event);
        assert.equal(user?.pagamento?.situacao, 1);
    }
});

test('worker drena backlog maior que vinte em uma unica execucao', async () => {
    const db = await createLedgerIndexes();
    process.env.MONGODB_URI = replicaSet.getUri();
    process.env.MONGODB_DB = 'webhook_tests';
    const { drainPendingWebhookEvents } = await import(
        '../../../../api/payment/webhook/payment_notification/route.js'
    );
    for (let index = 0; index < 25; index += 1) {
        const ingestion = await ingestWebhookEvent(db, {
            id: `evt_backlog_${index}`,
            event: 'PAYMENT_UPDATED',
            payment: { id: `pay_backlog_${index}` },
        });
        assert.equal(ingestion.kind, 'accepted');
    }
    const previousInfo = console.info;
    console.info = () => undefined;
    try {
        const result = await drainPendingWebhookEvents(1_000, 45_000);
        assert.equal(result.processed, 25);
        assert.equal(result.failed, 0);
        assert.equal(
            await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).countDocuments({ status: 'PROCESSED' }),
            25,
        );
    } finally {
        console.info = previousInfo;
    }
});

test('reconciliacao reutiliza validacao e bloqueia referencia externa cruzada', async () => {
    const db = await createLedgerIndexes();
    const seeded = await seedModernPayment(db);
    await db.collection('pagamentos.sessoes').updateOne(
        { _id: seeded.purchaseId },
        { $set: { updatedAt: new Date('2026-08-08T10:00:00Z') } },
    );
    const previous = {
        apiUrl: process.env.ASAAS_API_URL,
        apiKey: process.env.ASAAS_API_KEY,
        secret: process.env.PAYMENT_RECONCILIATION_SECRET,
        fetch: globalThis.fetch,
    };
    process.env.ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3';
    process.env.ASAAS_API_KEY = 'fixture-key';
    process.env.PAYMENT_RECONCILIATION_SECRET = 'fixture-root-secret-with-more-than-32-bytes';
    globalThis.fetch = (async () => Response.json({
        ...seeded.payment,
        externalReference: String(new ObjectId()),
        status: 'CONFIRMED',
    })) as typeof fetch;
    try {
        const [{ derivePaymentCredential }, { POST }] = await Promise.all([
            import('../../webhook-auth.ts'),
            import('../../../../api/payment/reconciliation/route.ts'),
        ]);
        const token = derivePaymentCredential('reconciliation');
        assert.ok(token);
        const response = await POST(new Request('http://localhost/api/payment/reconciliation', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
        }));
        assert.equal(response.status, 200);
        const [paymentSession, user] = await Promise.all([
            db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
            db.collection('usuarios').findOne({ _id: seeded.owner }),
        ]);
        assert.equal(paymentSession?.status, 'PAYMENT_REVIEW_REQUIRED');
        assert.match(paymentSession?.reconciliationReason || '', /PAYMENT_EXTERNAL_REFERENCE_MISMATCH/);
        assert.equal(paymentSession?.reconciliationLeaseUntil, undefined);
        assert.equal(user?.pagamento?.situacao, 2);
    } finally {
        globalThis.fetch = previous.fetch;
        if (previous.apiUrl === undefined) delete process.env.ASAAS_API_URL;
        else process.env.ASAAS_API_URL = previous.apiUrl;
        if (previous.apiKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = previous.apiKey;
        if (previous.secret === undefined) delete process.env.PAYMENT_RECONCILIATION_SECRET;
        else process.env.PAYMENT_RECONCILIATION_SECRET = previous.secret;
    }
});

test('reconciliacao consulta todo parcelamento e refund de uma parcela nao revoga', async () => {
    const db = await createLedgerIndexes();
    const installmentPlan = {
        installmentId: 'inst_reconciliation_3x',
        count: 3,
        totalValueCentavos: 1500,
        installmentValueCentavos: 500,
        observedPayments: [],
    };
    const seeded = await seedModernPayment(db, { status: 'CONFIRMED', installmentPlan });
    await db.collection('pagamentos.sessoes').updateOne(
        { _id: seeded.purchaseId },
        { $set: { updatedAt: new Date('2026-08-07T10:00:00Z') } },
    );
    const providerPayments = [
        { ...seeded.payment, id: 'pay_reconciliation_1', installmentNumber: 1, status: 'CONFIRMED' },
        {
            ...seeded.payment,
            id: 'pay_reconciliation_2',
            invoiceNumber: 'inv_reconciliation_2',
            installmentNumber: 2,
            status: 'REFUNDED',
            refunds: [{
                value: 5,
                status: 'DONE',
                dateCreated: '2026-08-08',
                transactionReceiptUrl: 'https://receipt/reconciliation-2',
            }],
        },
        { ...seeded.payment, id: 'pay_reconciliation_3', installmentNumber: 3, status: 'PENDING' },
    ];
    const requestedUrls: string[] = [];
    const previous = {
        apiUrl: process.env.ASAAS_API_URL,
        apiKey: process.env.ASAAS_API_KEY,
        secret: process.env.PAYMENT_RECONCILIATION_SECRET,
        fetch: globalThis.fetch,
    };
    process.env.ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3';
    process.env.ASAAS_API_KEY = 'fixture-key';
    process.env.PAYMENT_RECONCILIATION_SECRET = 'fixture-root-secret-with-more-than-32-bytes';
    globalThis.fetch = (async (input) => {
        requestedUrls.push(String(input));
        return Response.json({ data: providerPayments, hasMore: false });
    }) as typeof fetch;
    try {
        const [{ derivePaymentCredential }, { POST }] = await Promise.all([
            import('../../webhook-auth.ts'),
            import('../../../../api/payment/reconciliation/route.ts'),
        ]);
        const token = derivePaymentCredential('reconciliation');
        assert.ok(token);
        const response = await POST(new Request('http://localhost/api/payment/reconciliation', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
        }));
        assert.equal(response.status, 200);
        assert.ok(requestedUrls.some((url) =>
            url.includes('/payments?installment=inst_reconciliation_3x'),
        ));
        const [paymentSession, assignment, user] = await Promise.all([
            db.collection('pagamentos.sessoes').findOne({ _id: seeded.purchaseId }),
            db.collection('pagamentos.atribuicoes').findOne({ compraId: seeded.purchaseId }),
            db.collection('usuarios').findOne({ _id: seeded.owner }),
        ]);
        assert.equal(paymentSession?.status, 'CONFIRMED');
        assert.equal(assignment?.status, 'CONFIRMADA');
        assert.equal(user?.pagamento?.situacao, 1);
        assert.equal(paymentSession?.installmentPlan?.observedPayments.length, 3);
        assert.equal(paymentSession?.installmentPlan?.refundTotalDoneCentavos, 500);
        assert.equal(paymentSession?.reconciliationLeaseUntil, undefined);
    } finally {
        globalThis.fetch = previous.fetch;
        if (previous.apiUrl === undefined) delete process.env.ASAAS_API_URL;
        else process.env.ASAAS_API_URL = previous.apiUrl;
        if (previous.apiKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = previous.apiKey;
        if (previous.secret === undefined) delete process.env.PAYMENT_RECONCILIATION_SECRET;
        else process.env.PAYMENT_RECONCILIATION_SECRET = previous.secret;
    }
});

test('reconciliacao recupera parcelamento criado apos timeout antes da resposta', async () => {
    const db = await createLedgerIndexes();
    const purchaseId = new ObjectId();
    const owner = new ObjectId();
    const customer = `cus_${owner.toHexString()}`;
    const provisionalPlan = {
        installmentId: null,
        count: 3,
        totalValueCentavos: 1500,
        installmentValueCentavos: 500,
        observedPayments: [],
    };
    await db.collection('usuarios').insertOne({
        _id: owner,
        id_api: customer,
        pagamento: { situacao: 2, lista_pagamentos: [] },
    });
    await db.collection('pagamentos.sessoes').insertOne({
        _id: purchaseId,
        owner,
        type: 'ticket',
        edicaoId: 'CIEPS-2026',
        status: 'CREATING_PAYMENT',
        gatewayState: 'RECONCILIATION_REQUIRED',
        metodoPagamento: 'CREDIT_CARD',
        valorSelecionadoCentavos: { original: 1500, desconto: 0, final: 1500 },
        installmentPlan: provisionalPlan,
        activeKey: `CIEPS-2026:${owner}:ticket`,
        expiresAt: new Date('2026-08-08T12:00:00Z'),
        createdAt: new Date('2026-08-08T10:00:00Z'),
        updatedAt: new Date('2026-08-08T10:00:00Z'),
    });
    await db.collection('pagamentos.atribuicoes').insertOne({
        compraId: purchaseId,
        usuarioId: owner,
        edicaoId: 'CIEPS-2026',
        status: 'PAGAMENTO_PENDENTE',
        valorSelecionadoCentavos: { original: 1500, desconto: 0, final: 1500 },
        installmentPlan: provisionalPlan,
        pagamento: { metodo: 'CREDIT_CARD' },
    });
    const providerPayment = {
        id: 'pay_timeout_installment',
        invoiceNumber: 'inv_timeout_installment',
        installment: 'ins_timeout_installment',
        installmentNumber: 1,
        customer,
        externalReference: String(purchaseId),
        value: 5,
        billingType: 'CREDIT_CARD',
        status: 'CONFIRMED',
    };
    const previous = {
        apiUrl: process.env.ASAAS_API_URL,
        apiKey: process.env.ASAAS_API_KEY,
        secret: process.env.PAYMENT_RECONCILIATION_SECRET,
        fetch: globalThis.fetch,
    };
    process.env.ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3';
    process.env.ASAAS_API_KEY = 'fixture-key';
    process.env.PAYMENT_RECONCILIATION_SECRET = 'fixture-root-secret-with-more-than-32-bytes';
    globalThis.fetch = (async (input) => {
        assert.match(String(input), /payments\?externalReference=/);
        return Response.json({ data: [providerPayment], hasMore: false });
    }) as typeof fetch;
    try {
        const [{ derivePaymentCredential }, { POST }] = await Promise.all([
            import('../../webhook-auth.ts'),
            import('../../../../api/payment/reconciliation/route.ts'),
        ]);
        const token = derivePaymentCredential('reconciliation');
        assert.ok(token);
        const response = await POST(new Request('http://localhost/api/payment/reconciliation', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
        }));
        assert.equal(response.status, 200);
        const [paymentSession, assignment, user] = await Promise.all([
            db.collection('pagamentos.sessoes').findOne({ _id: purchaseId }),
            db.collection('pagamentos.atribuicoes').findOne({ compraId: purchaseId }),
            db.collection('usuarios').findOne({ _id: owner }),
        ]);
        assert.equal(paymentSession?.status, 'CONFIRMED');
        assert.equal(paymentSession?.installmentPlan?.installmentId, 'ins_timeout_installment');
        assert.equal(assignment?.status, 'CONFIRMADA');
        assert.equal(assignment?.installmentPlan?.installmentId, 'ins_timeout_installment');
        assert.equal(user?.pagamento?.situacao, 1);
    } finally {
        globalThis.fetch = previous.fetch;
        if (previous.apiUrl === undefined) delete process.env.ASAAS_API_URL;
        else process.env.ASAAS_API_URL = previous.apiUrl;
        if (previous.apiKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = previous.apiKey;
        if (previous.secret === undefined) delete process.env.PAYMENT_RECONCILIATION_SECRET;
        else process.env.PAYMENT_RECONCILIATION_SECRET = previous.secret;
    }
});
