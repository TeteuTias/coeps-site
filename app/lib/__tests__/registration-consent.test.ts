import test from 'node:test';
import assert from 'node:assert/strict';
import { isConsentMissing, LGPD_CONSENT_VERSION } from '../registration-consent.ts';

test('aceite da LGPD só conta quando gravado na versão atual', () => {
    assert.equal(isConsentMissing({}), true);
    assert.equal(isConsentMissing(null), true);
    assert.equal(isConsentMissing({ consentimentos: { lgpd: { aceito: false, versao: LGPD_CONSENT_VERSION } } }), true);
    assert.equal(isConsentMissing({ consentimentos: { lgpd: { aceito: true, versao: 'outra' } } }), true);
    assert.equal(isConsentMissing({ consentimentos: { lgpd: { aceito: true } } }), true);
    assert.equal(isConsentMissing({ consentimentos: { lgpd: { aceito: true, versao: LGPD_CONSENT_VERSION } } }), false);
});
