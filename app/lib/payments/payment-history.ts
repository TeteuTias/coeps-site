type PaymentRecord = Record<string, any>;

function normalized(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text || null;
}

function selectedValueInCents(assignment: PaymentRecord, method: string | null): number {
    const selected = Number(assignment?.valorSelecionadoCentavos?.final);
    if (Number.isInteger(selected) && selected >= 0) return selected;

    const finalValues = assignment?.valoresCentavos?.final;
    if (Number.isInteger(finalValues) && finalValues >= 0) return finalValues;
    const byMethod = method ? Number(finalValues?.[method]) : Number.NaN;
    return Number.isInteger(byMethod) && byMethod >= 0 ? byMethod : 0;
}

function publicStatus(assignment: PaymentRecord, session: PaymentRecord | undefined): string {
    if (assignment?.refundStatus === 'FULL' || assignment?.status === 'ESTORNADA') {
        return 'PAYMENT_REFUNDED';
    }
    if (['PARTIAL', 'PARTIAL_PLAN'].includes(assignment?.refundStatus)) {
        return 'PAYMENT_PARTIALLY_REFUNDED';
    }
    if (assignment?.refundStatus === 'IN_PROGRESS') return 'PAYMENT_REFUND_IN_PROGRESS';
    if (assignment?.refundStatus === 'DENIED') return 'PAYMENT_REFUND_DENIED';
    if (assignment?.chargebackStatus === 'AWAITING_REVERSAL') {
        return 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL';
    }
    if (assignment?.chargebackStatus === 'DISPUTED') return 'PAYMENT_CHARGEBACK_DISPUTE';
    if (assignment?.chargebackStatus === 'REQUESTED') return 'PAYMENT_CHARGEBACK_REQUESTED';
    if (assignment?.paymentFailureStatus) return String(assignment.paymentFailureStatus);

    if (assignment?.status === 'CONFIRMADA' || session?.status === 'CONFIRMED') {
        return 'PAYMENT_CONFIRMED';
    }
    if (assignment?.status === 'CANCELADA' || assignment?.status === 'EXPIRADA') {
        return 'PAYMENT_DELETED';
    }
    return 'PENDING';
}

function paymentKeys(payment: PaymentRecord): string[] {
    return [
        normalized(payment?.id) && `payment:${normalized(payment.id)}`,
        normalized(payment?.invoiceNumber) && `invoice:${normalized(payment.invoiceNumber)}`,
        normalized(payment?.checkoutId) && `checkout:${normalized(payment.checkoutId)}`,
    ].filter((value): value is string => Boolean(value));
}

function timestamp(value: unknown): number {
    const parsed = new Date(String(value ?? '')).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

export function mergePaymentHistory(
    legacyPayments: PaymentRecord[] = [],
    assignments: PaymentRecord[] = [],
    sessions: PaymentRecord[] = [],
): PaymentRecord[] {
    const merged = legacyPayments.map((payment) => ({ ...payment }));
    const keyToIndex = new Map<string, number>();
    merged.forEach((payment, index) => {
        for (const key of paymentKeys(payment)) keyToIndex.set(key, index);
    });
    const sessionsByPurchase = new Map(
        sessions.map((session) => [String(session?._id), session]),
    );

    for (const assignment of assignments) {
        const session = sessionsByPurchase.get(String(assignment?.compraId));
        const paymentId = normalized(assignment?.pagamento?.paymentId ?? session?.paymentId);
        const invoiceNumber = normalized(
            assignment?.pagamento?.invoiceNumber ?? session?.invoiceNumber,
        );
        const checkoutId = normalized(assignment?.pagamento?.checkoutId ?? session?.orderId);
        const keys = paymentKeys({ id: paymentId, invoiceNumber, checkoutId });
        const method = normalized(assignment?.pagamento?.metodo ?? session?.metodoPagamento);
        const createdAt = assignment?.createdAt ?? session?.createdAt ?? null;
        const modernRecord = {
            _id: String(assignment?.compraId ?? ''),
            id: paymentId ?? checkoutId ?? String(assignment?.compraId ?? ''),
            checkoutId,
            invoiceNumber: invoiceNumber ?? '',
            invoiceUrl: normalized(session?.paymentUrl) ?? '',
            dateCreated: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt ?? ''),
            status: publicStatus(assignment, session),
            value: selectedValueInCents(assignment, method) / 100,
            description: `Inscrição ${normalized(assignment?.edicaoId) ?? ''}`.trim(),
            billingType: method ?? '',
            _type: 'ticket',
            _eventID: '',
            refundStatus: assignment?.refundStatus ?? null,
            refundsSnapshot: assignment?.refundsSnapshot ?? null,
            chargebackStatus: assignment?.chargebackStatus ?? null,
            chargebackResolution: assignment?.chargebackResolution ?? null,
            financialReviewEvent: assignment?.financialReviewEvent ?? null,
            reviewRequiredAt: assignment?.reviewRequiredAt ?? null,
        };
        const existingIndex = keys
            .map((key) => keyToIndex.get(key))
            .find((index): index is number => index !== undefined);
        if (existingIndex !== undefined) {
            const legacyRecord = merged[existingIndex];
            merged[existingIndex] = {
                ...legacyRecord,
                ...modernRecord,
                invoiceUrl: modernRecord.invoiceUrl || legacyRecord.invoiceUrl || '',
                description: legacyRecord.description || modernRecord.description,
            };
            for (const key of keys) keyToIndex.set(key, existingIndex);
            continue;
        }

        const newIndex = merged.push(modernRecord) - 1;
        for (const key of keys) keyToIndex.set(key, newIndex);
    }

    return merged.sort((left, right) => timestamp(right.dateCreated) - timestamp(left.dateCreated));
}
