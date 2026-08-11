import { asaasRequestHeaders, isAsaasRetryableStatus } from './asaas.ts';

export type CheckoutPaymentsLookup = {
    conclusive: boolean;
    payments: Record<string, unknown>[];
    status: number | null;
};

function gatewayPayments(payload: unknown): Record<string, unknown>[] {
    if (!payload || typeof payload !== 'object') return [];
    const data = (payload as { data?: unknown }).data;
    return Array.isArray(data)
        ? data.filter((item): item is Record<string, unknown> =>
            Boolean(item && typeof item === 'object'))
        : [];
}

function paymentStatus(payment: Record<string, unknown>): string {
    return String(payment.status || '').toUpperCase();
}

export function paymentPreventsCheckoutCancellation(
    payment: Record<string, unknown>,
): boolean {
    const safelyCancellable = new Set([
        'PENDING',
        'OVERDUE',
        'DELETED',
        'CANCELED',
        'CANCELLED',
        'REPROVED',
        'REFUSED',
    ]);
    return !safelyCancellable.has(paymentStatus(payment));
}

export function checkoutPaymentIsCorrelated(
    payment: Record<string, unknown>,
    sessionId: string,
    checkoutId: string,
): boolean {
    const externalReference = String(payment.externalReference || '');
    const checkoutSession = String(payment.checkoutSession || '');
    return (
        (!externalReference || externalReference === sessionId) &&
        (!checkoutSession || checkoutSession === checkoutId)
    );
}

export async function lookupCheckoutPayments(
    apiUrl: string,
    apiKey: string,
    checkoutId: string,
    fetcher: typeof fetch = fetch,
): Promise<CheckoutPaymentsLookup> {
    try {
        const response = await fetcher(
            `${apiUrl}/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=100`,
            {
                headers: asaasRequestHeaders(apiKey, { apiUrl }),
                signal: AbortSignal.timeout(8_000),
            },
        );
        if (!response.ok) {
            return { conclusive: false, payments: [], status: response.status };
        }
        return {
            conclusive: true,
            payments: gatewayPayments(await response.json().catch(() => null)),
            status: response.status,
        };
    } catch {
        return { conclusive: false, payments: [], status: null };
    }
}

export async function requestCheckoutCancellation(
    apiUrl: string,
    apiKey: string,
    checkoutId: string,
    fetcher: typeof fetch = fetch,
): Promise<{ confirmed: boolean; retryable: boolean; status: number | null }> {
    try {
        const response = await fetcher(
            `${apiUrl}/checkouts/${encodeURIComponent(checkoutId)}/cancel`,
            {
                method: 'POST',
                headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
                signal: AbortSignal.timeout(10_000),
            },
        );
        return {
            confirmed: response.status === 200,
            retryable: isAsaasRetryableStatus(response.status),
            status: response.status,
        };
    } catch {
        return { confirmed: false, retryable: true, status: null };
    }
}
