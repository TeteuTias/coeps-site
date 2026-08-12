import test from 'node:test';
import assert from 'node:assert/strict';
import {
    checkoutPaymentIsCorrelated,
    lookupCheckoutPayments,
    paymentPreventsCheckoutCancellation,
    requestCheckoutCancellation,
} from '../checkout-cancellation.ts';

test('classifica estados de pagamento que impedem cancelar o checkout', () => {
    assert.equal(paymentPreventsCheckoutCancellation({ status: 'PENDING' }), false);
    assert.equal(paymentPreventsCheckoutCancellation({ status: 'OVERDUE' }), false);
    assert.equal(paymentPreventsCheckoutCancellation({ status: 'CONFIRMED' }), true);
    assert.equal(paymentPreventsCheckoutCancellation({ status: 'RECEIVED' }), true);
    assert.equal(paymentPreventsCheckoutCancellation({ status: '' }), true);
});

test('valida a correlação do pagamento com sessão e checkout', () => {
    assert.equal(checkoutPaymentIsCorrelated(
        { externalReference: 'session-1', checkoutSession: 'checkout-1' },
        'session-1',
        'checkout-1',
    ), true);
    assert.equal(checkoutPaymentIsCorrelated(
        { externalReference: 'other-session', checkoutSession: 'checkout-1' },
        'session-1',
        'checkout-1',
    ), false);
    assert.equal(checkoutPaymentIsCorrelated({}, 'session-1', 'checkout-1'), true);
});

test('consulta pagamentos do checkout e trata falha como inconclusiva', async () => {
    const successFetcher = (async () => Response.json({
        data: [{ id: 'pay_1', status: 'PENDING' }],
    })) as typeof fetch;
    const success = await lookupCheckoutPayments(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        successFetcher,
    );
    assert.equal(success.conclusive, true);
    assert.equal(success.payments.length, 1);

    const failedFetcher = (async () => new Response(null, { status: 503 })) as typeof fetch;
    const failed = await lookupCheckoutPayments(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        failedFetcher,
    );
    assert.deepEqual(failed, { conclusive: false, payments: [], status: 503 });
});

test('só confirma cancelamento do checkout com HTTP 200 conclusivo', async () => {
    const confirmed = await requestCheckoutCancellation(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        (async () => Response.json({ status: 'CANCELED' })) as typeof fetch,
    );
    assert.deepEqual(confirmed, { confirmed: true, retryable: false, status: 200 });

    const retryable = await requestCheckoutCancellation(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        (async () => new Response(null, { status: 429 })) as typeof fetch,
    );
    assert.deepEqual(retryable, { confirmed: false, retryable: true, status: 429 });

    const serverFailure = await requestCheckoutCancellation(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        (async () => new Response(null, { status: 503 })) as typeof fetch,
    );
    assert.deepEqual(serverFailure, { confirmed: false, retryable: true, status: 503 });

    const ambiguous = await requestCheckoutCancellation(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        (async () => new Response(null, { status: 400 })) as typeof fetch,
    );
    assert.deepEqual(ambiguous, { confirmed: false, retryable: false, status: 400 });

    const timeout = await requestCheckoutCancellation(
        'https://api-sandbox.asaas.com/v3',
        'test-key',
        'checkout-1',
        (async () => { throw new Error('timeout'); }) as typeof fetch,
    );
    assert.deepEqual(timeout, { confirmed: false, retryable: true, status: null });
});
