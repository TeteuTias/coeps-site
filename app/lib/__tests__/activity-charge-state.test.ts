import assert from 'node:assert/strict';
import test from 'node:test';
import {
    activityChargeHoldUntil,
    activityChargeState,
    isActivityChargeExpired,
} from '../activity-charge-state.js';

const AGORA = new Date('2026-11-11T15:00:00-03:00');
const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60 * 1000);
const cobranca = (extra: Record<string, unknown>) => ({
    _type: 'activity',
    _eventID: 'evento1',
    id: 'pay_1',
    invoiceUrl: 'https://asaas.test/i/pay_1',
    value: 60,
    status: 'PENDING',
    dueDate: '2026-11-11',
    _reservedAt: minutosAtras(5),
    ...extra,
});

test('PIX gerado há menos de 15 minutos é pendente, não inscrito', () => {
    const r = activityChargeState([cobranca({})], 'evento1', AGORA);
    assert.equal(r?.state, 'pendente');
    assert.equal(r?.link, 'https://asaas.test/i/pay_1');
    assert.equal(r?.holdUntil, new Date(AGORA.getTime() + 10 * 60 * 1000).toISOString());
});

test('reserva de 15 minutos: no limite ainda vale, depois expira', () => {
    assert.equal(activityChargeState([cobranca({ _reservedAt: minutosAtras(15) })], 'evento1', AGORA)?.state, 'pendente');
    assert.equal(activityChargeState([cobranca({ _reservedAt: minutosAtras(16) })], 'evento1', AGORA)?.state, 'vencida');
    assert.equal(isActivityChargeExpired(cobranca({ _reservedAt: minutosAtras(16) }), AGORA), true);
});

test('horário da reserva gravado como texto (JSON) também vale', () => {
    const r = activityChargeState([cobranca({ _reservedAt: minutosAtras(20).toISOString() })], 'evento1', AGORA);
    assert.equal(r?.state, 'vencida');
});

test('pagamento confirmado ou recebido é pago, mesmo depois dos 15 minutos', () => {
    for (const status of ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CONFIRMED', 'RECEIVED']) {
        const r = activityChargeState([cobranca({ status, _reservedAt: minutosAtras(600) })], 'evento1', AGORA);
        assert.equal(r?.state, 'paga');
        assert.equal(isActivityChargeExpired(cobranca({ status, _reservedAt: minutosAtras(600) }), AGORA), false);
    }
});

test('cobrança antiga, sem horário da reserva: vale até o fim do dia do vencimento', () => {
    const antiga = (extra: Record<string, unknown>) => cobranca({ _reservedAt: undefined, ...extra });
    assert.equal(activityChargeState([antiga({})], 'evento1', AGORA)?.state, 'pendente');
    assert.equal(activityChargeState([antiga({ dueDate: '2026-11-10' })], 'evento1', AGORA)?.state, 'vencida');
    assert.equal(activityChargeState([antiga({ status: 'PAYMENT_OVERDUE' })], 'evento1', AGORA)?.state, 'vencida');
    assert.equal(activityChargeHoldUntil(antiga({ dueDate: undefined })), null);
    assert.equal(isActivityChargeExpired(antiga({ dueDate: undefined }), AGORA), false);
});

test('cobrança renovada volta a ser pendente por mais 15 minutos', () => {
    const r = activityChargeState([cobranca({ status: 'PAYMENT_UPDATED', _reservedAt: minutosAtras(1) })], 'evento1', AGORA);
    assert.equal(r?.state, 'pendente');
});

test('paga vence qualquer outra; pendente vence a expirada', () => {
    const paga = cobranca({ id: 'pay_2', status: 'PAYMENT_RECEIVED' });
    const expirada = cobranca({ id: 'pay_0', _reservedAt: minutosAtras(40) });
    assert.equal(activityChargeState([expirada, cobranca({}), paga], 'evento1', AGORA)?.id, 'pay_2');
    assert.equal(activityChargeState([expirada, cobranca({})], 'evento1', AGORA)?.state, 'pendente');
});

test('ignora ingresso, outra atividade, cobrança cancelada e lista inválida', () => {
    assert.equal(activityChargeState([cobranca({ _type: 'ticket' })], 'evento1', AGORA), null);
    assert.equal(activityChargeState([cobranca({ _eventID: 'outro' })], 'evento1', AGORA), null);
    assert.equal(activityChargeState([cobranca({ status: 'PAYMENT_REFUNDED' })], 'evento1', AGORA), null);
    assert.equal(activityChargeState(undefined, 'evento1', AGORA), null);
    assert.equal(activityChargeState([null, 'x'], 'evento1', AGORA), null);
});
