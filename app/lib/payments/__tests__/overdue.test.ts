import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cancellationEligibleAtForDelinquency,
    earliestDate,
    gatewayDeletionWasConfirmed,
    getPaymentOverdueGraceDays,
    isCancellationEligible,
} from '../overdue.ts';

test('usa três dias de carência e recusa configurações inválidas', () => {
    assert.equal(getPaymentOverdueGraceDays(undefined), 3);
    assert.equal(getPaymentOverdueGraceDays('0'), 0);
    assert.equal(getPaymentOverdueGraceDays('10'), 10);
    assert.equal(getPaymentOverdueGraceDays('-1'), 3);
    assert.equal(getPaymentOverdueGraceDays('2.5'), 3);
    assert.equal(getPaymentOverdueGraceDays('31'), 3);
});

test('webhook repetido não posterga o cancelamento', () => {
    const firstEvent = new Date('2026-08-01T12:00:00.000Z');
    const repeatedEvent = new Date('2026-08-02T12:00:00.000Z');
    const firstEligible = cancellationEligibleAtForDelinquency(firstEvent, 3);
    const repeatedEligible = cancellationEligibleAtForDelinquency(repeatedEvent, 3);

    assert.equal(
        earliestDate(firstEligible, repeatedEligible).toISOString(),
        '2026-08-04T12:00:00.000Z',
    );
});

test('usa o vencimento do provedor mesmo quando o webhook chega atrasado', () => {
    const delayedWebhook = new Date('2026-08-10T12:00:00.000Z');
    const eligibleAt = cancellationEligibleAtForDelinquency(
        delayedWebhook,
        3,
        false,
        '2026-08-01',
    );

    assert.equal(eligibleAt.toISOString(), '2026-08-05T02:59:59.999Z');
});

test('cancelamento do boleto torna a cobrança elegível sem nova carência', () => {
    const eventAt = new Date('2026-08-01T12:00:00.000Z');
    const eligibleAt = cancellationEligibleAtForDelinquency(eventAt, 3, true);

    assert.equal(eligibleAt.toISOString(), eventAt.toISOString());
    assert.equal(isCancellationEligible(eligibleAt, eventAt), true);
});

test('só aceita exclusão explicitamente confirmada pelo provedor', () => {
    assert.equal(gatewayDeletionWasConfirmed(true, { deleted: true }), true);
    assert.equal(gatewayDeletionWasConfirmed(true, { deleted: false }), false);
    assert.equal(gatewayDeletionWasConfirmed(false, { deleted: true }), false);
    assert.equal(gatewayDeletionWasConfirmed(true, null), false);
});
