import test from 'node:test';
import assert from 'node:assert/strict';
import {
    credentialFingerprint,
    derivePaymentCredential,
    isReconciliationAuthorized,
    secureEquals,
} from '../webhook-auth.ts';

const rootSecret = '0123456789abcdef0123456789abcdef';
const apiUrl = 'https://api-sandbox.asaas.com/v3';

test('deriva credenciais estaticas separadas por finalidade e ambiente', () => {
    const webhook = derivePaymentCredential('webhook', { rootSecret, apiUrl });
    const reconciliation = derivePaymentCredential('reconciliation', { rootSecret, apiUrl });

    assert.equal(webhook, 'whsec_NnyB23OHvbme4OquG0F4UkKgmUUB-um-25_cM1ThB1o');
    assert.equal(reconciliation, 'rec_am-wPWIbzAYhv8hUkWpLTjfcJmHvCwIKo5IbtYXh_AA');
    assert.notEqual(webhook, reconciliation);
    assert.notEqual(
        webhook,
        derivePaymentCredential('webhook', {
            rootSecret,
            apiUrl: 'https://api.asaas.com/v3',
        }),
    );
});

test('compara bearer em tempo constante e expoe apenas fingerprint curta', () => {
    const webhook = derivePaymentCredential('webhook', { rootSecret, apiUrl });

    assert.equal(secureEquals(webhook, webhook), true);
    assert.equal(secureEquals(`${webhook}x`, webhook), false);
    assert.equal(secureEquals(null, webhook), false);
    assert.match(credentialFingerprint(webhook) ?? '', /^[a-f0-9]{12}$/);
});

test('aceita somente o bearer de conciliacao derivado da raiz', () => {
    const previousRoot = process.env.PAYMENT_RECONCILIATION_SECRET;
    const previousApiUrl = process.env.ASAAS_API_URL;

    try {
        process.env.PAYMENT_RECONCILIATION_SECRET = rootSecret;
        process.env.ASAAS_API_URL = apiUrl;
        assert.equal(
            isReconciliationAuthorized(derivePaymentCredential('reconciliation')),
            true,
        );
        assert.equal(isReconciliationAuthorized(rootSecret), false);
        assert.equal(isReconciliationAuthorized('null'), false);
    } finally {
        if (previousRoot === undefined) delete process.env.PAYMENT_RECONCILIATION_SECRET;
        else process.env.PAYMENT_RECONCILIATION_SECRET = previousRoot;
        if (previousApiUrl === undefined) delete process.env.ASAAS_API_URL;
        else process.env.ASAAS_API_URL = previousApiUrl;
    }
});
