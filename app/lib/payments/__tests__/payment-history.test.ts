import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { mergePaymentHistory } from '../payment-history.ts';

test('adiciona checkout PIX moderno ausente da lista legada', () => {
    const compraId = new ObjectId();
    const history = mergePaymentHistory([], [{
        compraId,
        edicaoId: 'CIEPS-2026',
        status: 'CONFIRMADA',
        pagamento: { metodo: 'PIX', checkoutId: 'checkout_pix_1', paymentId: 'pay_pix_1' },
        valorSelecionadoCentavos: { final: 500 },
        createdAt: new Date('2026-08-08T12:00:00.000Z'),
    }], [{
        _id: compraId,
        status: 'CONFIRMED',
        metodoPagamento: 'PIX',
        orderId: 'checkout_pix_1',
        paymentId: 'pay_pix_1',
        paymentUrl: 'https://example.test/pix',
    }]);

    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'PAYMENT_CONFIRMED');
    assert.equal(history[0].value, 5);
    assert.equal(history[0].billingType, 'PIX');
});

test('nao duplica cartao que ja existe na lista legada', () => {
    const compraId = new ObjectId();
    const history = mergePaymentHistory([{
        id: 'pay_card_1',
        invoiceNumber: '123',
        status: 'PAYMENT_CONFIRMED',
        dateCreated: '2026-08-08',
    }], [{
        compraId,
        edicaoId: 'CIEPS-2026',
        status: 'CONFIRMADA',
        pagamento: { metodo: 'CREDIT_CARD', paymentId: 'pay_card_1', invoiceNumber: '123' },
        valorSelecionadoCentavos: { final: 500 },
    }], [{ _id: compraId, status: 'CONFIRMED' }]);

    assert.equal(history.length, 1);
    assert.equal(history[0].id, 'pay_card_1');
});

test('estado moderno corrige entrada legada correlacionada que ficou desatualizada', () => {
    const compraId = new ObjectId();
    const history = mergePaymentHistory([{
        id: 'pay_refunded_1',
        invoiceNumber: '456',
        status: 'PAYMENT_CONFIRMED',
        description: 'Inscrição original',
    }], [{
        compraId,
        edicaoId: 'CIEPS-2026',
        status: 'ESTORNADA',
        refundStatus: 'FULL',
        pagamento: { paymentId: 'pay_refunded_1', invoiceNumber: '456' },
        refundsSnapshot: { totalDoneCentavos: 500 },
    }], [{ _id: compraId, status: 'REFUNDED' }]);

    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'PAYMENT_REFUNDED');
    assert.equal(history[0].description, 'Inscrição original');
    assert.equal(history[0].refundsSnapshot.totalDoneCentavos, 500);
});

test('prioriza estados de estorno e chargeback sobre CONFIRMADA', () => {
    const partialId = new ObjectId();
    const disputedId = new ObjectId();
    const history = mergePaymentHistory([], [
        {
            compraId: partialId,
            edicaoId: 'CIEPS-2026',
            status: 'CONFIRMADA',
            refundStatus: 'PARTIAL',
            pagamento: { paymentId: 'pay_partial' },
        },
        {
            compraId: disputedId,
            edicaoId: 'CIEPS-2026',
            status: 'CONFIRMADA',
            chargebackStatus: 'DISPUTED',
            pagamento: { paymentId: 'pay_disputed' },
        },
    ]);

    assert.deepEqual(
        new Set(history.map((item) => item.status)),
        new Set(['PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_CHARGEBACK_DISPUTE']),
    );
});
