import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canTransitionPaymentSession,
    isTerminalPaymentSessionStatus,
} from '../states.ts';

test('permite apenas as transições financeiras previstas', () => {
    assert.equal(canTransitionPaymentSession('OPEN', 'CREATING_PAYMENT'), true);
    assert.equal(canTransitionPaymentSession('PAYMENT_PENDING', 'CONFIRMED'), true);
    assert.equal(
        canTransitionPaymentSession('PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'),
        true,
    );
    assert.equal(canTransitionPaymentSession('PAYMENT_REVIEW_REQUIRED', 'CONFIRMED'), true);
    assert.equal(canTransitionPaymentSession('CONFIRMED', 'REFUNDED'), true);
    assert.equal(canTransitionPaymentSession('CONFIRMED', 'OPEN'), false);
    assert.equal(canTransitionPaymentSession('REFUNDED', 'CONFIRMED'), false);
});

test('identifica estados terminais', () => {
    assert.equal(isTerminalPaymentSessionStatus('CONFIRMED'), true);
    assert.equal(isTerminalPaymentSessionStatus('PAYMENT_PENDING'), false);
});
