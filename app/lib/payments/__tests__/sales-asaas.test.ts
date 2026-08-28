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
    const sessionRoute = await readFile('app/api/v1/payment/session/route.ts', 'utf8');
    const preparation = await readFile('app/lib/payments/customer-sync.ts', 'utf8');
    const registration = await readFile('app/api/post/updateData/route.ts', 'utf8');
    const customerLookup = sessionRoute.indexOf("db.collection('usuarios').findOne");
    const customerPreparation = sessionRoute.indexOf('await preparePaymentCustomer');
    assert.ok(customerLookup >= 0, 'a sessão deve consultar o vínculo Asaas existente');
    assert.ok(customerPreparation > customerLookup, 'a sessão deve provisionar o Customer após a consulta');
    assert.equal(sessionRoute.includes('payment_customer_not_found'), false);
    assert.equal(sessionRoute.includes('if (!user?.id_api)'), false);
    assert.match(preparation, /if \(storedCustomerId\)/);
    assert.match(preparation, /await updateExistingAsaasCustomer/);
    assert.match(preparation, /await ensureAsaasCustomer/);
    assert.match(registration, /pagamento\?\.situacao !== 1/);
    assert.match(registration, /await syncPendingAsaasCustomer/);
    assert.equal(registration.includes('ensureAsaasCustomer'), false);
    assert.equal(registration.includes("method: 'POST'"), false);
    assert.equal(preparation.includes('city:'), false);
});

test('PIX confirma telefone no Customer antes de criar o checkout', async () => {
    const page = await readFile('app/(auth)/pagamentos/page.tsx', 'utf8');
    const pixRoute = await readFile('app/api/v1/payment/session/pix/route.ts', 'utf8');
    const holderValidation = pixRoute.indexOf('normalizeCardHolderInput(body.personalInfo)');
    const customerUpdate = pixRoute.indexOf('await updateExistingAsaasCustomer');
    const checkoutCreation = pixRoute.indexOf('await createAsaasCheckoutWithCustomerCityRepair');

    assert.ok(holderValidation >= 0, 'o PIX deve validar os dados do titular');
    assert.ok(customerUpdate > holderValidation, 'o PIX deve atualizar o Customer após validar o titular');
    assert.ok(checkoutCreation > customerUpdate, 'o PIX deve atualizar o telefone antes do checkout');
    assert.match(pixRoute, /phone: payer\.value\.phone/);
    assert.match(pixRoute, /mobilePhone: payer\.value\.phone/);
    assert.match(pixRoute, /'userProps\.phone': payer\.value\.phone/);
    assert.match(page, /JSON\.stringify\(\{ sessionId: paymentSession\._id, personalInfo \}\)/);
    assert.match(page, /paymentMethod === "PIX" \? 'Criar cobrança PIX' : 'Continuar'/);
});
