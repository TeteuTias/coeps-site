import assert from 'node:assert/strict';
import test from 'node:test';
import { activityChargeState } from '../activity-charge-state.js';

const HOJE = '2026-11-11';
const cobranca = (extra: Record<string, unknown>) => ({
    _type: 'activity',
    _eventID: 'evento1',
    id: 'pay_1',
    invoiceUrl: 'https://asaas.test/i/pay_1',
    value: 60,
    status: 'PENDING',
    dueDate: HOJE,
    ...extra,
});

test('PIX gerado e ainda não pago é pendente, não inscrito', () => {
    const r = activityChargeState([cobranca({})], 'evento1', HOJE);
    assert.equal(r?.state, 'pendente');
    assert.equal(r?.link, 'https://asaas.test/i/pay_1');
});

test('pagamento confirmado ou recebido é pago', () => {
    for (const status of ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CONFIRMED', 'RECEIVED']) {
        assert.equal(activityChargeState([cobranca({ status })], 'evento1', HOJE)?.state, 'paga');
    }
});

test('cobrança vencida pelo webhook ou pela data é vencida', () => {
    assert.equal(activityChargeState([cobranca({ status: 'PAYMENT_OVERDUE' })], 'evento1', HOJE)?.state, 'vencida');
    assert.equal(activityChargeState([cobranca({ dueDate: '2026-11-10' })], 'evento1', HOJE)?.state, 'vencida');
    assert.equal(activityChargeState([cobranca({ dueDate: HOJE })], 'evento1', HOJE)?.state, 'pendente');
});

test('cobrança renovada (PAYMENT_UPDATED com vencimento novo) volta a ser pendente', () => {
    assert.equal(activityChargeState([cobranca({ status: 'PAYMENT_UPDATED' })], 'evento1', HOJE)?.state, 'pendente');
});

test('paga vence qualquer outra; pendente vence a vencida', () => {
    const paga = cobranca({ id: 'pay_2', status: 'PAYMENT_RECEIVED' });
    const vencida = cobranca({ id: 'pay_0', status: 'PAYMENT_OVERDUE' });
    assert.equal(activityChargeState([vencida, cobranca({}), paga], 'evento1', HOJE)?.id, 'pay_2');
    assert.equal(activityChargeState([vencida, cobranca({})], 'evento1', HOJE)?.state, 'pendente');
});

test('ignora ingresso, outra atividade, cobrança cancelada e lista inválida', () => {
    assert.equal(activityChargeState([cobranca({ _type: 'ticket' })], 'evento1', HOJE), null);
    assert.equal(activityChargeState([cobranca({ _eventID: 'outro' })], 'evento1', HOJE), null);
    assert.equal(activityChargeState([cobranca({ status: 'PAYMENT_REFUNDED' })], 'evento1', HOJE), null);
    assert.equal(activityChargeState(undefined, 'evento1', HOJE), null);
    assert.equal(activityChargeState([null, 'x'], 'evento1', HOJE), null);
});
