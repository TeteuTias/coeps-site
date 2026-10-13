import test from 'node:test';
import assert from 'node:assert/strict';
import { BSON, ObjectId, type Document } from 'mongodb';
import { processEvent } from '../../../api/payment/webhook/payment_notification/route.js';

// Only the persistence boundary is simulated. The real webhook, financial
// validation, code consumption and legacy correlation run without a database.
const copy = (document: Document) => BSON.deserialize(BSON.serialize(document));
const at = (document: Document, path: string) =>
    path.split('.').reduce((value, key) => value?.[key], document);

function matches(document: Document, filter: Document): boolean {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === '$or') return expected.some((item: Document) => matches(document, item));
        const actual = at(document, key);
        if (expected instanceof ObjectId) return expected.equals(actual);
        if (expected && typeof expected === 'object') {
            if ('$exists' in expected) return (actual !== undefined) === expected.$exists;
            if ('$in' in expected) return expected.$in.some((value: unknown) => String(value) === String(actual));
            if ('$elemMatch' in expected) return actual?.some((item: Document) => matches(item, expected.$elemMatch));
            throw new Error(`Unsupported fixture filter: ${key}`);
        }
        return actual === expected;
    });
}

function fixture({ profile = 'ORGANIZADOR', method = 'CREDIT_CARD', history = true } = {}) {
    const owner = new ObjectId();
    const purchaseId = new ObjectId();
    const codeId = new ObjectId();
    const payment = {
        id: 'pay_fixture', invoiceNumber: 'invoice_fixture', customer: 'cus_fixture',
        externalReference: String(purchaseId), billingType: method, value: 220,
        status: method === 'PIX' ? 'RECEIVED' : 'CONFIRMED',
    };
    const historyEntry = { ...payment, _type: 'ticket', status: 'PENDING' };
    const user: Document = {
        _id: owner, id_api: payment.customer,
        pagamento: { situacao: 2, tipo_pagamento: '', lista_pagamentos: history ? [historyEntry] : [] },
    };
    const snapshot = { codigoId: codeId, codigoNormalizado: 'FIXTURE', perfilUtilizador: profile };
    const session: Document = {
        _id: purchaseId, owner, type: 'ticket', edicaoId: 'CIEPS-2026', status: 'PAYMENT_PENDING',
        metodoPagamento: method, paymentId: payment.id, invoiceNumber: payment.invoiceNumber,
        perfilUtilizador: profile, codigoDesconto: snapshot, valorSelecionadoCentavos: { final: 22000 },
    };
    const assignment: Document = {
        _id: new ObjectId(), compraId: purchaseId, usuarioId: owner, type: 'ticket',
        status: 'PAGAMENTO_PENDENTE', perfilUtilizador: profile,
        valorSelecionadoCentavos: { final: 22000 },
    };
    const code: Document = {
        _id: codeId, tipo: 'DESCONTO', status: 'RESERVADO', perfilUtilizador: profile,
        reserva: { compraId: purchaseId },
    };
    const records: Record<string, Document[]> = {
        usuarios: [user], 'pagamentos.sessoes': [session],
        'pagamentos.atribuicoes': [assignment], 'pagamentos.codigos': [code],
        'pagamentos.comprovantes': [],
    };
    const typeWrites: string[] = [];
    function apply(document: Document, update: Document, options: Document = {}, inserted = false) {
        for (const operator of Object.keys(update)) {
            assert.ok(['$set', '$unset', '$setOnInsert'].includes(operator), `Unexpected update: ${operator}`);
        }
        const set = { ...(inserted ? update.$setOnInsert : {}), ...update.$set };
        if ('pagamento.tipo_pagamento' in set) typeWrites.push(set['pagamento.tipo_pagamento']);
        for (const [key, value] of Object.entries(set)) {
            if (key.startsWith('pagamento.lista_pagamentos.$[payment].')) {
                const filter = options.arrayFilters[0];
                const entryFilter = Object.fromEntries(Object.entries(filter)
                    .map(([field, condition]) => [field.replace(/^payment\./, ''), condition]));
                for (const entry of document.pagamento.lista_pagamentos) {
                    if (matches(entry, entryFilter)) entry[key.split('.').at(-1)!] = value;
                }
            } else {
                const keys = key.split('.');
                const leaf = keys.pop()!;
                const target = keys.reduce((item, part) => (item[part] ??= {}), document);
                target[leaf] = value;
            }
        }
        for (const key of Object.keys(update.$unset || {})) {
            const keys = key.split('.');
            const leaf = keys.pop()!;
            const target = keys.reduce((item, part) => item?.[part], document);
            if (target) delete target[leaf];
        }
    }
    const db = {
        collection(name: string) {
            const rows = records[name];
            assert.ok(rows, `Unexpected collection: ${name}`);
            return {
                async findOne(filter: Document) {
                    const row = rows.find(item => matches(item, filter));
                    return row ? copy(row) : null;
                },
                async updateOne(filter: Document, update: Document, options: Document = {}) {
                    let row = rows.find(item => matches(item, filter));
                    const inserted = !row && options.upsert;
                    if (inserted) rows.push(row = copy(filter));
                    if (!row) return { matchedCount: 0, modifiedCount: 0 };
                    apply(row, update, options, inserted);
                    return { matchedCount: 1, modifiedCount: 1 };
                },
                async findOneAndUpdate(filter: Document, update: Document, options: Document = {}) {
                    const row = rows.find(item => matches(item, filter));
                    if (!row) return null;
                    apply(row, update, options);
                    return copy(row);
                },
            };
        },
    };
    const payload = {
        id: 'evt_fixture', event: method === 'PIX' ? 'PAYMENT_RECEIVED' : 'PAYMENT_CONFIRMED', payment,
    };
    return { db, payload, user, session, assignment, code, records, typeWrites };
}

function assertHistory(f: ReturnType<typeof fixture>, eventId = f.payload.id) {
    const entry = f.user.pagamento.lista_pagamentos[0];
    assert.equal(entry.status, f.payload.event);
    assert.equal(entry.lastWebhookEventId, eventId);
    assert.ok(entry.lastWebhookAt instanceof Date);
}

for (const [method, history] of [['CREDIT_CARD', true], ['PIX', true], ['PIX', false]] as const) {
    test(`organizador ${method}, historico=${history}: confirmacao preserva perfil e atualiza historico`, async () => {
        const f = fixture({ method, history });
        const result = await processEvent(f.db, f.payload, undefined);
        assert.equal(result.requiresReview, false);
        assert.equal(f.user.pagamento.tipo_pagamento, 'organizador');
        assert.deepEqual(f.typeWrites, ['organizador']);
        assert.equal(f.user.pagamento.situacao, 1);
        assert.equal(String(f.user.pagamento.compraId), String(f.session._id));
        assert.equal(f.session.status, 'CONFIRMED');
        assert.equal(f.assignment.status, 'CONFIRMADA');
        assert.equal(f.assignment.perfilUtilizador, 'ORGANIZADOR');
        assert.equal(f.code.status, 'USADO');
        if (history) assertHistory(f);
    });
}

test('congressista moderno continua asaas e atualiza historico', async () => {
    const f = fixture({ profile: 'CONGRESSISTA' });
    await processEvent(f.db, f.payload, undefined);
    assert.equal(f.user.pagamento.tipo_pagamento, 'asaas');
    assert.equal(f.user.pagamento.situacao, 1);
    assertHistory(f);
});

test('pagamento exclusivamente legado conserva confirmacao e tipo asaas', async () => {
    const f = fixture();
    f.records['pagamentos.sessoes'] = [];
    f.records['pagamentos.atribuicoes'] = [];
    await processEvent(f.db, f.payload, undefined);
    assert.equal(f.user.pagamento.tipo_pagamento, 'asaas');
    assert.equal(f.user.pagamento.situacao, 1);
    assertHistory(f);
});

for (const initialType of ['organizador', 'asaas']) {
    test(`sessao ja confirmada preserva ${initialType}, sem correcao retroativa`, async () => {
        const f = fixture();
        f.session.status = 'CONFIRMED';
        f.assignment.status = 'CONFIRMADA';
        f.user.pagamento.situacao = 1;
        f.user.pagamento.tipo_pagamento = initialType;
        await processEvent(f.db, { ...f.payload, id: 'evt_later' }, undefined);
        assert.equal(f.user.pagamento.tipo_pagamento, initialType);
        assert.deepEqual(f.typeWrites, []);
        assertHistory(f, 'evt_later');
    });
}

test('confirmacao de parcela posterior preserva organizador e atualiza a entrada correspondente', async () => {
    const f = fixture();
    f.session.status = 'CONFIRMED';
    f.assignment.status = 'CONFIRMADA';
    f.session.installmentPlan = {
        installmentId: 'inst_fixture', count: 2, installmentValueCentavos: 11000,
    };
    f.user.pagamento.situacao = 1;
    f.user.pagamento.tipo_pagamento = 'organizador';
    const laterPayment = {
        ...f.payload.payment, id: 'pay_second', invoiceNumber: 'invoice_second',
        installment: 'inst_fixture', installmentNumber: 2, value: 110,
    };
    f.user.pagamento.lista_pagamentos.push({ ...laterPayment, _type: 'ticket', status: 'PENDING' });
    const result = await processEvent(f.db, { ...f.payload, payment: laterPayment }, undefined);
    assert.equal(result.requiresReview, false);
    assert.equal(f.user.pagamento.tipo_pagamento, 'organizador');
    assert.deepEqual(f.typeWrites, []);
    assert.equal(f.user.pagamento.lista_pagamentos[0].status, 'PENDING');
    assert.equal(f.user.pagamento.lista_pagamentos[1].lastWebhookEventId, f.payload.id);
    assert.equal(f.session.installmentPlan.observedPayments[0].paymentId, 'pay_second');
});

test('valor divergente nao libera inscricao nem consome codigo, mas registra historico', async () => {
    const f = fixture();
    const result = await processEvent(f.db, {
        ...f.payload, payment: { ...f.payload.payment, value: 1 },
    }, undefined);
    assert.equal(result.requiresReview, true);
    assert.equal(f.session.status, 'PAYMENT_REVIEW_REQUIRED');
    assert.match(f.session.reconciliationReason, /PAYMENT_VALUE_MISMATCH/);
    assert.equal(f.user.pagamento.situacao, 2);
    assert.equal(f.user.pagamento.tipo_pagamento, '');
    assert.deepEqual(f.typeWrites, []);
    assert.equal(f.assignment.status, 'PAGAMENTO_PENDENTE');
    assert.equal(f.code.status, 'RESERVADO');
    assertHistory(f);
});

test('PIX confirmado sem recebimento nao libera inscricao', async () => {
    const f = fixture({ method: 'PIX' });
    f.payload.event = 'PAYMENT_CONFIRMED';
    f.payload.payment.status = 'CONFIRMED';
    await processEvent(f.db, f.payload, undefined);
    assert.equal(f.user.pagamento.situacao, 2);
    assert.equal(f.user.pagamento.tipo_pagamento, '');
    assert.equal(f.session.status, 'PAYMENT_PENDING');
    assert.equal(f.code.status, 'RESERVADO');
    assertHistory(f);
});
