import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MINIMUM_ROOT_SECRET_BYTES = 32;
const PLACEHOLDER_PATTERN = /^(replace|change|your-|null|undefined)/i;

export type PaymentCredentialPurpose = 'webhook' | 'reconciliation';

function normalizeAsaasHost(apiUrl = process.env.ASAAS_API_URL): string | null {
    if (!apiUrl) return null;

    try {
        return new URL(apiUrl).host.toLowerCase();
    } catch {
        return null;
    }
}

export function getPaymentAuthRootSecret(): string | null {
    const secret = process.env.PAYMENT_RECONCILIATION_SECRET?.trim();

    if (
        !secret ||
        Buffer.byteLength(secret, 'utf8') < MINIMUM_ROOT_SECRET_BYTES ||
        PLACEHOLDER_PATTERN.test(secret)
    ) {
        return null;
    }

    return secret;
}

export function derivePaymentCredential(
    purpose: PaymentCredentialPurpose,
    options: { rootSecret?: string; apiUrl?: string } = {},
): string | null {
    const rootSecret = options.rootSecret ?? getPaymentAuthRootSecret();
    const host = normalizeAsaasHost(options.apiUrl);

    if (!rootSecret || Buffer.byteLength(rootSecret, 'utf8') < MINIMUM_ROOT_SECRET_BYTES || !host) {
        return null;
    }

    const context = purpose === 'webhook'
        ? `coeps/payments/asaas/webhook/v1|${host}`
        : `coeps/payments/reconciliation/v1|${host}`;
    const prefix = purpose === 'webhook' ? 'whsec_' : 'rec_';
    const digest = createHmac('sha256', rootSecret)
        .update(context, 'utf8')
        .digest('base64url');

    return `${prefix}${digest}`;
}

export function secureEquals(received: string | null | undefined, expected: string | null | undefined): boolean {
    if (!received || !expected) return false;

    const receivedBuffer = Buffer.from(received, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    return receivedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function isReconciliationAuthorized(received: string | null | undefined): boolean {
    const derived = derivePaymentCredential('reconciliation');
    return secureEquals(received, derived);
}

export function credentialFingerprint(value: string | null | undefined): string | null {
    if (!value) return null;
    return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}
