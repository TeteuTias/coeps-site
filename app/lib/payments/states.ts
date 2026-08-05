import type { PaymentSessionStatus } from '@/lib/types/payments/paymentCode.t';

const ALLOWED_TRANSITIONS: Record<PaymentSessionStatus, readonly PaymentSessionStatus[]> = {
    OPEN: ['CREATING_PAYMENT', 'EXPIRED', 'CANCELLED'],
    CREATING_PAYMENT: ['PAYMENT_PENDING', 'CANCELLED'],
    PAYMENT_PENDING: ['CONFIRMED', 'EXPIRED', 'CANCELLED', 'PAYMENT_REVIEW_REQUIRED'],
    PAYMENT_REVIEW_REQUIRED: ['CONFIRMED', 'CANCELLED', 'REFUNDED'],
    CONFIRMED: ['REFUNDED'],
    EXPIRED: [],
    CANCELLED: [],
    REFUNDED: [],
};

export function canTransitionPaymentSession(
    from: PaymentSessionStatus,
    to: PaymentSessionStatus,
): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalPaymentSessionStatus(status: PaymentSessionStatus): boolean {
    return ['CONFIRMED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].includes(status);
}
