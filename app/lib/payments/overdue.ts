const DEFAULT_OVERDUE_GRACE_DAYS = 3;
const MAX_OVERDUE_GRACE_DAYS = 30;

export function getPaymentOverdueGraceDays(
    rawValue = process.env.PAYMENT_OVERDUE_GRACE_DAYS,
): number {
    if (rawValue === undefined || rawValue === '') return DEFAULT_OVERDUE_GRACE_DAYS;

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_OVERDUE_GRACE_DAYS) {
        return DEFAULT_OVERDUE_GRACE_DAYS;
    }
    return parsed;
}

export function cancellationEligibleAtForDelinquency(
    eventAt: Date,
    graceDays: number,
    bankSlipCancelled = false,
    dueDate?: unknown,
): Date {
    if (bankSlipCancelled) return new Date(eventAt);
    const normalizedDueDate = String(dueDate || '').trim();
    const dueDateEnd = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDueDate)
        ? new Date(`${normalizedDueDate}T23:59:59.999-03:00`)
        : null;
    const base = dueDateEnd && Number.isFinite(dueDateEnd.getTime())
        ? dueDateEnd
        : eventAt;
    return new Date(base.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

export function earliestDate(current: unknown, candidate: Date): Date {
    const currentDate = current instanceof Date ? current : new Date(String(current || ''));
    if (!Number.isFinite(currentDate.getTime())) return candidate;
    return currentDate <= candidate ? currentDate : candidate;
}

export function isCancellationEligible(value: unknown, now = new Date()): boolean {
    const eligibleAt = value instanceof Date ? value : new Date(String(value || ''));
    return Number.isFinite(eligibleAt.getTime()) && eligibleAt <= now;
}

export function gatewayDeletionWasConfirmed(
    responseOk: boolean,
    payload: unknown,
): boolean {
    return Boolean(
        responseOk &&
        payload &&
        typeof payload === 'object' &&
        (payload as { deleted?: unknown }).deleted === true,
    );
}
