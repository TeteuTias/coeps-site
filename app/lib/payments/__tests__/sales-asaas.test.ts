import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { asaasRequestHeaders, asaasUserAgent, isAsaasRetryableStatus } from '../asaas.ts';
import { isPaymentSalesEnabled } from '../sales.ts';

test('PAYMENT_SALES_ENABLED preserva compatibilidade quando ausente e pausa com false', () => {
    assert.equal(isPaymentSalesEnabled({}), true);
    assert.equal(isPaymentSalesEnabled({ PAYMENT_SALES_ENABLED: '' }), true);
    assert.equal(isPaymentSalesEnabled({ PAYMENT_SALES_ENABLED: 'true' }), true);
    for (const value of ['false', 'FALSE', '0', 'off', 'no']) {
        assert.equal(isPaymentSalesEnabled({ PAYMENT_SALES_ENABLED: value }), false);
    }
});

test('kill switch antecede autenticação, banco e reserva em todas as rotas de venda', async () => {
    const routes = [
        'app/api/v1/payment/session/route.ts',
        'app/api/v1/payment/session/pix/route.ts',
        'app/api/v1/payment/session/creditCard/route.ts',
        'app/api/payment/create_payment/route.js',
        'app/api/payment/createCreditCardPayment/route.js',
        'app/api/payment/createActivityPayment/route.js',
    ];
    for (const route of routes) {
        const source = await readFile(route, 'utf8');
        const guard = source.indexOf('if (!isPaymentSalesEnabled())');
        const requestWork = source.indexOf('await getUserId');
        assert.ok(guard >= 0, `${route} precisa do kill switch`);
        assert.ok(requestWork < 0 || guard < requestWork, `${route} deve pausar antes de criar recursos`);
    }
});

test('headers Asaas identificam aplicação e ambiente sem usar User-Agent genérico', () => {
    const sandbox = asaasRequestHeaders('secret-key', {
        json: true,
        apiUrl: 'https://api-sandbox.asaas.com/v3',
    });
    assert.equal(sandbox.access_token, 'secret-key');
    assert.equal(sandbox['content-type'], 'application/json');
    assert.match(sandbox['User-Agent'], /^COEPS-Site\/[^ ]+ \(Node\.js; sandbox\)$/);
    assert.match(asaasUserAgent('https://api.asaas.com/v3'), /production\)$/);
    assert.equal(isAsaasRetryableStatus(429), true);
    assert.equal(isAsaasRetryableStatus(503), true);
    assert.equal(isAsaasRetryableStatus(422), false);
});

test('cartão persiste o plano provisório antes do POST e aceita a corrida do webhook', async () => {
    for (const relativePath of [
        'app/api/v1/payment/session/creditCard/route.ts',
        'app/api/payment/createCreditCardPayment/route.js',
    ]) {
        const source = await readFile(relativePath, 'utf8');
        const preparation = source.indexOf('PAYMENT_INSTALLMENT_PREPARATION_FAILED');
        const gatewayPost = source.indexOf("fetch(`${apiUrl}/payments`");
        assert.ok(preparation >= 0, `${relativePath} não prepara o parcelamento`);
        assert.ok(gatewayPost > preparation, `${relativePath} chama o Asaas antes do snapshot local`);
        assert.match(source, /gatewayResponseMatchesAdvancedSession/);
    }
});

test('pagamento provisiona Customer e cadastro posterior apenas sincroniza o ID existente', async () => {
    const preparation = await readFile('app/lib/payments/customer-sync.ts', 'utf8');
    const registration = await readFile('app/api/post/updateData/route.ts', 'utf8');
    assert.match(preparation, /if \(storedCustomerId\)/);
    assert.match(preparation, /await updateExistingAsaasCustomer/);
    assert.match(preparation, /await ensureAsaasCustomer/);
    assert.match(registration, /pagamento\?\.situacao !== 1/);
    assert.match(registration, /await syncPendingAsaasCustomer/);
    assert.equal(registration.includes('ensureAsaasCustomer'), false);
    assert.equal(registration.includes("method: 'POST'"), false);
    assert.equal(preparation.includes('city:'), false);
});
