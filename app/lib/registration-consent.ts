export const LGPD_CONSENT_VERSION = 'cieps-lgpd-2026-08-27';

type ConsentUser = { consentimentos?: { lgpd?: { aceito?: unknown; versao?: unknown } | null } | null } | null | undefined;

// Sem aceite gravado da versão atual (ex.: contas criadas durante o rollback de setembro).
export function isConsentMissing(user: ConsentUser): boolean {
    const lgpd = user?.consentimentos?.lgpd;
    return !(lgpd?.aceito === true && lgpd.versao === LGPD_CONSENT_VERSION);
}
