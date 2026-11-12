import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId, type Document } from 'mongodb';
import { updateLegacyPayment } from '../../../api/payment/webhook/payment_notification/route.js';

// Banco falso só na borda: o webhook legado real decide o que gravar.
// O filtro de minicursos é avaliado como o Mongo faz com { campo: { $not: { $elemMatch } } }:
// casa quando nenhum registro tem o mesmo userId e a cobrança na lista.
function fixture(cancelamentos: Document[] = []) {
    const userId = String(new ObjectId());
    const eventId = new ObjectId();
    const etapaId = new ObjectId();
    const charge = { id: 'pay_atividade', customer: 'cus_1', billingType: 'CREDIT_CARD', value: 55 };
    const user: Document = {
        _id: new ObjectId(userId),
        id_api: charge.customer,
        pagamento: {
            situacao: 1,
            lista_pagamentos: [{ ...charge, _type: 'activity', _userId: userId, _eventID: String(eventId), status: 'PAYMENT_CONFIRMED' }],
        },
    };
    const activity: Document = {
        _id: eventId,
        participants: [] as string[],
        incluiAtividades: [String(etapaId)],
        cancelamentosSemEstorno: cancelamentos.map((item) => ({ ...item, userId: item.userId ?? userId })),
    };
    const minicursosUpdates: Document[] = [];
    const db = {
        collection(name: string) {
            if (name === 'usuarios') {
                return {
                    async findOne() { return structuredClone(user); },
                    async updateOne() { return { matchedCount: 1, modifiedCount: 1 }; },
                };
            }
            assert.equal(name, 'minicursos');
            return {
                async findOne() { return activity; },
                async updateOne(filter: Document, update: Document) {
                    minicursosUpdates.push({ filter, update });
                    const guard = filter.cancelamentosSemEstorno?.$not?.$elemMatch;
                    const blocked = guard && activity.cancelamentosSemEstorno.some((item: Document) =>
                        item.userId === guard.userId && (item.cobrancas ?? []).includes(guard.cobrancas));
                    if (String(filter._id) !== String(eventId) || blocked) {
                        return { matchedCount: 0, modifiedCount: 0 };
                    }
                    const id = update.$addToSet?.participants;
                    if (id && !activity.participants.includes(id)) activity.participants.push(id);
                    return { matchedCount: 1, modifiedCount: 1 };
                },
                async updateMany(filter: Document, update: Document) {
                    minicursosUpdates.push({ filter, update, many: true });
                    return { matchedCount: 1, modifiedCount: 1 };
                },
            };
        },
    };
    const payload = { id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: charge };
    return { db, payload, userId, activity, minicursosUpdates };
}

test('cobrança cancelada sem estorno pelo Admin: pagamento posterior não reinscreve nem põe no pacote', async () => {
    const f = fixture([{ cobrancas: ['pay_atividade'], motivo: 'SEM_ESTORNO_ACEITO' }]);
    assert.equal(await updateLegacyPayment(f.db, f.payload, undefined), true);
    assert.deepEqual(f.activity.participants, []);
    assert.equal(f.minicursosUpdates.length, 1);
    assert.deepEqual(f.minicursosUpdates[0].filter.cancelamentosSemEstorno, {
        $not: { $elemMatch: { userId: f.userId, cobrancas: 'pay_atividade' } },
    });
});

test('cancelamento de outra cobrança (compra nova) não bloqueia: reinscreve e sincroniza o pacote', async () => {
    const f = fixture([{ cobrancas: ['pay_antiga'], motivo: 'SEM_ESTORNO_ACEITO' }]);
    await updateLegacyPayment(f.db, f.payload, undefined);
    assert.deepEqual(f.activity.participants, [f.userId]);
    assert.ok(f.minicursosUpdates.some((call) => call.many && call.update.$addToSet?.participants === f.userId));
});

test('sem cancelamento registrado o webhook reinscreve como antes', async () => {
    const f = fixture();
    await updateLegacyPayment(f.db, f.payload, undefined);
    assert.deepEqual(f.activity.participants, [f.userId]);
});
