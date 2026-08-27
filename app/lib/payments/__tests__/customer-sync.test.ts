import test from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
    buildAsaasCustomerPayload,
    normalizeCardHolderInput,
    normalizePaymentCustomerInput,
    preparePaymentCustomer,
} from '../customer-sync.ts';
import { syncPendingAsaasCustomer } from '../customer-profile-sync.ts';
import { getPaymentRemoteIp } from '../remote-ip.ts';

const validPayer = {
    name: 'Maria da Silva',
    cpfCnpj: '52998224725',
    postalCode: '38.440-000',
    addressNumber: '120',
    complement: '',
};

function userDb(updateCalls: Array<Record<string, unknown>> = []) {
    return {
        collection(name: string) {
            assert.equal(name, 'usuarios');
            return {
                async updateOne(_filter: unknown, update: Record<string, unknown>) {
                    updateCalls.push(update);
                    return { acknowledged: true, matchedCount: 1 };
                },
            };
        },
    } as unknown as Db;
}

test('normaliza os quatro dados mínimos e nunca envia city textual', () => {
    const normalized = normalizePaymentCustomerInput(validPayer);
    assert.equal(normalized.ok, true);
    const payload = buildAsaasCustomerPayload({
        userId: '507f1f77bcf86cd799439011',
        payer: normalized.value,
        email: 'maria@example.com',
        address: '',
        province: null,
    });

    assert.equal(payload.postalCode, '38440000');
    assert.equal(payload.addressNumber, '120');
    assert.equal('city' in payload, false);
    assert.equal('address' in payload, false);
    assert.equal('province' in payload, false);
    assert.equal('complement' in payload, false);
});

test('Customer com id_api faz somente PUT e conserva o mesmo ID', async () => {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
            url: String(input),
            method: init?.method || 'GET',
            body: JSON.parse(String(init?.body || '{}')),
        });
        return Response.json({ id: 'cus_existing' });
    }) as typeof fetch;
    const result = await preparePaymentCustomer({
        db: userDb(),
        owner: new ObjectId('507f1f77bcf86cd799439011'),
        userId: '507f1f77bcf86cd799439011',
        existingCustomerId: 'cus_existing',
        payer: validPayer,
        email: 'maria@example.com',
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: fetchMock,
    });

    assert.equal(result.ok, true);
    if (result.ok === true) assert.equal(result.customerId, 'cus_existing');
    assert.deepEqual(calls.map((call) => call.method), ['PUT']);
    assert.match(calls[0].url, /customers\/cus_existing$/);
    assert.equal('city' in calls[0].body, false);
});

test('falha ao atualizar ID existente não cria Customer como fallback', async () => {
    const methods: string[] = [];
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(init?.method || 'GET');
        return Response.json({ errors: [] }, { status: 503 });
    }) as typeof fetch;
    const result = await preparePaymentCustomer({
        db: userDb(),
        owner: new ObjectId('507f1f77bcf86cd799439011'),
        userId: '507f1f77bcf86cd799439011',
        existingCustomerId: 'cus_existing',
        payer: validPayer,
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: fetchMock,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(methods, ['PUT']);
});

test('resposta inválida ao atualizar Customer exige revisão e não cria outro', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const methods: string[] = [];
    const result = await preparePaymentCustomer({
        db: userDb(updates),
        owner: new ObjectId('507f1f77bcf86cd799439011'),
        userId: '507f1f77bcf86cd799439011',
        existingCustomerId: 'cus_existing',
        payer: validPayer,
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
            methods.push(init?.method || 'GET');
            return Response.json({ id: 'cus_different' });
        }) as typeof fetch,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(methods, ['PUT']);
    const lastSet = updates.at(-1)?.$set as Record<string, unknown>;
    const sync = lastSet['integracoes.asaas.customerSync'] as Record<string, unknown>;
    assert.equal(sync.status, 'REVIEW_REQUIRED');
});

test('valida todos os dados do titular e usa IP real em produção', () => {
    assert.equal(normalizeCardHolderInput({ ...validPayer, email: 'maria@example.com', phone: '34999999999' }).ok, true);
    assert.equal(normalizeCardHolderInput({ ...validPayer, email: 'invalido', phone: '34999999999' }).ok, false);
    const request = new Request('https://example.test', {
        headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });
    assert.equal(getPaymentRemoteIp(request), '203.0.113.10');
});

test('falha transitória pós-pagamento permanece PENDING e usa apenas PUT', async () => {
    const updates: Array<Record<string, any>> = [];
    const user = {
        _id: new ObjectId('507f1f77bcf86cd799439011'),
        id_api: 'cus_existing',
        informacoes_usuario: {
            nome: 'Maria da Silva',
            cpf: '52998224725',
            email: 'maria@example.com',
            numero_telefone: '34999999999',
            endereco: {
                postalCode: '38440000',
                addressNumber: '120',
                address: 'Rua Central',
                province: 'Centro',
            },
        },
        integracoes: { asaas: { customerSync: { status: 'PROCESSING', attempts: 1 } } },
    };
    const db = {
        collection(name: string) {
            assert.equal(name, 'usuarios');
            return {
                async findOneAndUpdate() { return user; },
                async updateOne(_filter: unknown, update: Record<string, any>) {
                    updates.push(update);
                    return { acknowledged: true, matchedCount: 1 };
                },
            };
        },
    } as unknown as Db;
    const methods: string[] = [];
    const result = await syncPendingAsaasCustomer({
        db,
        owner: user._id,
        userId: user._id.toHexString(),
        apiUrl: 'https://api-sandbox.asaas.com/v3',
        apiKey: 'test-key',
        fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
            methods.push(init?.method || 'GET');
            return Response.json({}, { status: 503 });
        }) as typeof fetch,
        now: () => new Date('2026-08-27T12:00:00.000Z'),
    });

    assert.equal(result.status, 'PENDING');
    assert.deepEqual(methods, ['PUT']);
    assert.equal(updates.at(-1)?.$set?.['integracoes.asaas.customerSync.status'], 'PENDING');
    assert.ok(updates.at(-1)?.$set?.['integracoes.asaas.customerSync.nextAttemptAt'] instanceof Date);
});
