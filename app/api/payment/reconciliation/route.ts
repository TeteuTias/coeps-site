import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../lib/mongodb.js';
import { isReconciliationAuthorized } from '../../../lib/payments/webhook-auth.ts';
import { asaasRequestHeaders } from '../../../lib/payments/asaas.ts';
import { drainPendingWebhookEvents, processEvent } from '../webhook/payment_notification/route.js';
import {
    releaseDiscountReservation,
    updatePaymentAssignment,
} from '../../../lib/payments/codes.ts';
import { runPaymentTransaction } from '../../../lib/payments/transactions.ts';
import { requestCheckoutCancellation } from '../../../lib/payments/checkout-cancellation.ts';
import { switchPixSessionToCreditCard } from '../../../lib/payments/pix-switch.ts';
import { cancelPaymentSession } from '../../../lib/payments/purchase-cancellation.ts';
import {
    cancellationEligibleAtForDelinquency,
    gatewayDeletionWasConfirmed,
    getPaymentOverdueGraceDays,
    isCancellationEligible,
} from '../../../lib/payments/overdue.ts';

export const maxDuration = 110;

function firstGatewayItem(payload: unknown): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = (payload as { data?: unknown }).data;
    return Array.isArray(data) && data[0] && typeof data[0] === 'object'
        ? (data[0] as Record<string, unknown>)
        : null;
}

function gatewayStatus(record: Record<string, unknown>): string {
    return String(record.status || '').toUpperCase();
}

function isGatewayPaymentConfirmed(record: Record<string, unknown>): boolean {
    const status = gatewayStatus(record);
    if (['RECEIVED', 'RECEIVED_IN_CASH'].includes(status)) return true;
    return status === 'CONFIRMED' && String(record.billingType || '').toUpperCase() !== 'PIX';
}

function isGatewayPaymentRefunded(status: string): boolean {
    return status === 'REFUNDED';
}

function isGatewayPaymentCancelled(status: string): boolean {
    return ['DELETED', 'CANCELLED', 'CANCELED'].includes(status);
}

async function lookupPendingPayment(
    apiUrl: string,
    apiKey: string,
    paymentSession: Record<string, unknown>,
): Promise<{ conclusive: boolean; record: Record<string, unknown> | null }> {
    const headers = asaasRequestHeaders(apiKey, { apiUrl });
    const paymentId = typeof paymentSession.paymentId === 'string'
        ? paymentSession.paymentId
        : null;
    const checkoutId = typeof paymentSession.orderId === 'string'
        ? paymentSession.orderId
        : null;
    const url = paymentId
        ? `${apiUrl}/payments/${encodeURIComponent(paymentId)}`
        : checkoutId
            ? `${apiUrl}/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=2`
            : `${apiUrl}/payments?externalReference=${encodeURIComponent(String(paymentSession._id))}&limit=2`;

    try {
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
        if (response.status === 404) return { conclusive: true, record: null };
        if (!response.ok) return { conclusive: false, record: null };

        const payload = await response.json().catch(() => null);
        const record = paymentId
            ? payload && typeof payload === 'object'
                ? (payload as Record<string, unknown>)
                : null
            : firstGatewayItem(payload);
        return { conclusive: true, record };
    } catch (error) {
        console.error('Falha temporária ao consultar pagamento pendente:', error);
        return { conclusive: false, record: null };
    }
}

async function deletePendingGatewayPayment(
    apiUrl: string,
    apiKey: string,
    paymentId: string,
): Promise<{ confirmed: boolean; status: number | null }> {
    try {
        const response = await fetch(
            `${apiUrl}/payments/${encodeURIComponent(paymentId)}`,
            {
                method: 'DELETE',
                headers: asaasRequestHeaders(apiKey, { apiUrl }),
                signal: AbortSignal.timeout(8_000),
            },
        );
        const payload = await response.json().catch(() => null);
        return {
            confirmed: gatewayDeletionWasConfirmed(response.ok, payload),
            status: response.status,
        };
    } catch (error) {
        console.error('Falha temporária ao encerrar cobrança vencida:', error);
        return { confirmed: false, status: null };
    }
}

async function reconcileConfirmedPayment(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    client: Awaited<ReturnType<typeof connectToDatabase>>['client'],
    paymentSession: Record<string, any>,
    payment: Record<string, any>,
): Promise<boolean> {
    return runPaymentTransaction(client, async (mongoSession) => {
        const status = gatewayStatus(payment);
        await processEvent(
            db,
            {
                id: `reconciliation:${paymentSession._id}:${String(payment.id || 'unknown')}:${status}`,
                event: ['RECEIVED', 'RECEIVED_IN_CASH'].includes(status)
                    ? 'PAYMENT_RECEIVED'
                    : 'PAYMENT_CONFIRMED',
                payment,
            },
            mongoSession,
        );
        const updated = await db.collection('pagamentos.sessoes').findOneAndUpdate(
            { _id: paymentSession._id },
            { $unset: { reconciliationLeaseUntil: '' } },
            { returnDocument: 'after', projection: { status: 1 }, session: mongoSession },
        );
        return updated?.status === 'CONFIRMED';
    });
}

async function lookupInstallmentPayments(
    apiUrl: string,
    apiKey: string,
    paymentSession: Record<string, any>,
): Promise<{ conclusive: boolean; records: Record<string, any>[] }> {
    const installmentId = String(paymentSession.installmentPlan?.installmentId || '');
    const expectedCount = Number(paymentSession.installmentPlan?.count || 0);
    if (!installmentId || !Number.isInteger(expectedCount) || expectedCount < 2) {
        return { conclusive: true, records: [] };
    }
    const headers = asaasRequestHeaders(apiKey, { apiUrl });
    const records: Record<string, any>[] = [];
    try {
        for (let offset = 0; offset < expectedCount; offset += 100) {
            const limit = Math.min(100, expectedCount - offset);
            const response = await fetch(
                `${apiUrl}/payments?installment=${encodeURIComponent(installmentId)}&limit=${limit}&offset=${offset}`,
                { headers, signal: AbortSignal.timeout(8_000) },
            );
            if (!response.ok) return { conclusive: false, records: [] };
            const body = await response.json().catch(() => null);
            const page = Array.isArray(body?.data) ? body.data : [];
            records.push(...page);
            if (!body?.hasMore || page.length === 0) break;
        }
        return { conclusive: true, records };
    } catch (error) {
        console.error('Falha temporária ao consultar plano parcelado:', error);
        return { conclusive: false, records: [] };
    }
}

function eventForGatewayPayment(payment: Record<string, any>): string {
    const status = gatewayStatus(payment);
    if (status === 'RECEIVED' || status === 'RECEIVED_IN_CASH') return 'PAYMENT_RECEIVED';
    if (status === 'CONFIRMED') return 'PAYMENT_CONFIRMED';
    if (status === 'REFUNDED') return 'PAYMENT_REFUNDED';
    if (status === 'OVERDUE') return 'PAYMENT_OVERDUE';
    if (['DELETED', 'CANCELLED', 'CANCELED'].includes(status)) return 'PAYMENT_DELETED';
    return 'PAYMENT_UPDATED';
}

async function reconcileInstallmentPayments(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    client: Awaited<ReturnType<typeof connectToDatabase>>['client'],
    paymentSession: Record<string, any>,
    records: Record<string, any>[],
): Promise<string> {
    const ordered = [...records].sort(
        (left, right) => Number(left.installmentNumber || 0) - Number(right.installmentNumber || 0),
    );
    for (const payment of ordered) {
        await runPaymentTransaction(client, (mongoSession) => processEvent(
            db,
            {
                id: `reconciliation:${paymentSession._id}:${String(payment.id || 'unknown')}:${gatewayStatus(payment)}`,
                event: eventForGatewayPayment(payment),
                payment,
            },
            mongoSession,
        ));
    }
    const updated = await db.collection('pagamentos.sessoes').findOneAndUpdate(
        { _id: paymentSession._id },
        { $unset: { reconciliationLeaseUntil: '' } },
        { returnDocument: 'after', projection: { status: 1 } },
    );
    return String(updated?.status || paymentSession.status);
}

async function reconcileRefundedPayment(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    client: Awaited<ReturnType<typeof connectToDatabase>>['client'],
    paymentSession: Record<string, any>,
    payment: Record<string, any>,
): Promise<boolean> {
    return runPaymentTransaction(client, async (mongoSession) => {
        await processEvent(
            db,
            {
                id: `reconciliation:${paymentSession._id}:${String(payment.id || 'unknown')}:REFUNDED`,
                event: 'PAYMENT_REFUNDED',
                payment,
            },
            mongoSession,
        );
        const updated = await db.collection('pagamentos.sessoes').findOneAndUpdate(
            { _id: paymentSession._id },
            { $unset: { reconciliationLeaseUntil: '' } },
            { returnDocument: 'after', projection: { status: 1 }, session: mongoSession },
        );
        return updated?.status === 'REFUNDED';
    });
}

async function cancelUnpaidSession(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    client: Awaited<ReturnType<typeof connectToDatabase>>['client'],
    paymentSession: Record<string, any>,
    gatewayState: string,
): Promise<boolean> {
    return runPaymentTransaction(client, async (mongoSession) => {
        const now = new Date();
        const transition = await db.collection('pagamentos.sessoes').updateOne(
            {
                _id: paymentSession._id,
                status: {
                    $in: [
                        'CREATING_PAYMENT',
                        'PAYMENT_PENDING',
                        'PAYMENT_REVIEW_REQUIRED',
                    ],
                },
            },
            {
                $set: {
                    status: 'CANCELLED',
                    gatewayState,
                    terminalAt: now,
                    updatedAt: now,
                },
                $unset: { activeKey: '', reconciliationLeaseUntil: '' },
            },
            { session: mongoSession },
        );
        if (transition.modifiedCount !== 1) return false;

        await releaseDiscountReservation(
            db,
            paymentSession._id as ObjectId,
            mongoSession,
        );
        await updatePaymentAssignment(
            db,
            paymentSession._id as ObjectId,
            'CANCELADA',
            undefined,
            mongoSession,
        );
        await db.collection('usuarios').updateOne(
            { _id: paymentSession.owner, 'pagamento.situacao': { $ne: 1 } },
            { $set: { 'pagamento.situacao': 0 } },
            { session: mongoSession },
        );
        return true;
    });
}

export async function POST(request: Request) {
    const receivedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    if (!isReconciliationAuthorized(receivedSecret)) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const apiUrl = process.env.ASAAS_API_URL;
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiUrl || !apiKey) {
        return Response.json({ error: 'payment_gateway_not_configured' }, { status: 503 });
    }

    const reconciliationDeadline = Date.now() + 100_000;
    const webhookEvents = await drainPendingWebhookEvents(1_000, 45_000);
    const { db, client } = await connectToDatabase();
    const now = new Date();
    const staleCreatingCutoff = new Date(now.getTime() - 2 * 60 * 1000);
    const staleConfirmedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const candidates = await db
        .collection('pagamentos.sessoes')
        .find({
            $and: [
                {
                    $or: [
                        {
                            status: 'CREATING_PAYMENT',
                            $or: [
                                { gatewayState: 'RECONCILIATION_REQUIRED' },
                                { updatedAt: { $lte: staleCreatingCutoff } },
                            ],
                        },
                        {
                            status: 'PAYMENT_PENDING',
                            updatedAt: { $lte: staleCreatingCutoff },
                        },
                        {
                            status: 'PAYMENT_REVIEW_REQUIRED',
                            updatedAt: { $lte: staleCreatingCutoff },
                        },
                        {
                            status: 'OPEN',
                            $or: [
                                {
                                    'purchaseCancellation.status': {
                                        $in: ['CANCELLING', 'RETRYABLE'],
                                    },
                                },
                                {
                                    'purchaseCancellation.status': 'REVIEW_REQUIRED',
                                    'purchaseCancellation.gatewayCancellationConfirmedAt': {
                                        $exists: true,
                                    },
                                },
                            ],
                        },
                        {
                            status: 'CONFIRMED',
                            updatedAt: { $lte: staleConfirmedCutoff },
                        },
                    ],
                },
                {
                    $or: [
                        { reconciliationLeaseUntil: { $exists: false } },
                        { reconciliationLeaseUntil: { $lte: now } },
                    ],
                },
            ],
        })
        .sort({ updatedAt: 1 })
        .limit(25)
        .toArray();

    const counters = {
        webhookEvents,
        inspected: 0,
        recovered: 0,
        confirmed: 0,
        refunded: 0,
        cancelled: 0,
        pending: 0,
    };

    for (const candidate of candidates) {
        if (Date.now() >= reconciliationDeadline) break;
        const lease = await db.collection('pagamentos.sessoes').findOneAndUpdate(
            {
                _id: candidate._id,
                status: candidate.status,
                $or: [
                    { reconciliationLeaseUntil: { $exists: false } },
                    { reconciliationLeaseUntil: { $lte: now } },
                ],
            },
            {
                $set: {
                    reconciliationLeaseUntil: new Date(now.getTime() + 2 * 60 * 1000),
                    lastReconciliationAt: now,
                },
            },
            { returnDocument: 'after' },
        );
        if (!lease) continue;
        counters.inspected += 1;

        try {

        if (
            ['CANCELLING', 'RETRYABLE'].includes(
                String(lease.purchaseCancellation?.status || ''),
            ) || (
                lease.purchaseCancellation?.status === 'REVIEW_REQUIRED' &&
                lease.purchaseCancellation?.gatewayCancellationConfirmedAt
            )
        ) {
            const cancellationResult = await cancelPaymentSession({
                db,
                client,
                owner: lease.owner as ObjectId,
                sessionId: lease._id as ObjectId,
                apiUrl,
                apiKey,
            });
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: lease._id },
                { $unset: { reconciliationLeaseUntil: '' } },
            );
            if (cancellationResult.kind === 'completed') {
                counters.cancelled += 1;
                counters.recovered += 1;
            } else {
                counters.pending += 1;
            }
            continue;
        }

        if (
            lease.paymentMethodSwitch?.target === 'CREDIT_CARD' &&
            ['CANCELLING', 'RETRYABLE'].includes(String(lease.paymentMethodSwitch?.status || ''))
        ) {
            const switchResult = await switchPixSessionToCreditCard({
                db,
                client,
                owner: lease.owner as ObjectId,
                sessionId: lease._id as ObjectId,
                apiUrl,
                apiKey,
            });
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: lease._id },
                { $unset: { reconciliationLeaseUntil: '' } },
            );
            if (switchResult.kind === 'completed') counters.recovered += 1;
            else counters.pending += 1;
            continue;
        }

        if (lease.installmentPlan?.installmentId) {
            const lookup = await lookupInstallmentPayments(apiUrl, apiKey, lease);
            if (!lookup.conclusive) {
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: lease._id },
                    {
                        $set: { lastReconciliationErrorAt: new Date(), updatedAt: new Date() },
                        $unset: { reconciliationLeaseUntil: '' },
                    },
                );
                counters.pending += 1;
                continue;
            }
            const expectedId = String(lease.installmentPlan.installmentId);
            const expectedValue = Number(lease.installmentPlan.installmentValueCentavos);
            const expectedCount = Number(lease.installmentPlan.count);
            const installmentNumbers = lookup.records.map((record) => Number(record.installmentNumber));
            const invalidPlan = lookup.records.length > expectedCount ||
                new Set(installmentNumbers.filter(Number.isInteger)).size !==
                    installmentNumbers.filter(Number.isInteger).length ||
                lookup.records.some((record) =>
                    String(record.installment || '') !== expectedId ||
                    Math.round(Number(record.value) * 100) !== expectedValue,
                );
            if (invalidPlan) {
                const reviewAt = new Date();
                await Promise.all([
                    db.collection('pagamentos.sessoes').updateOne(
                        { _id: lease._id },
                        {
                            $set: {
                                status: lease.status === 'CONFIRMED'
                                    ? 'CONFIRMED'
                                    : 'PAYMENT_REVIEW_REQUIRED',
                                gatewayState: 'PAYMENT_REVIEW_REQUIRED',
                                reconciliationReason: 'INSTALLMENT_PLAN_RECONCILIATION_MISMATCH',
                                reviewRequiredAt: reviewAt,
                                updatedAt: reviewAt,
                            },
                            $unset: { reconciliationLeaseUntil: '' },
                        },
                    ),
                    db.collection('pagamentos.atribuicoes').updateOne(
                        { compraId: lease._id },
                        {
                            $set: {
                                reconciliationReason: 'INSTALLMENT_PLAN_RECONCILIATION_MISMATCH',
                                reviewRequiredAt: reviewAt,
                                updatedAt: reviewAt,
                            },
                        },
                    ),
                ]);
                counters.pending += 1;
                continue;
            }
            const finalStatus = await reconcileInstallmentPayments(
                db,
                client,
                lease,
                lookup.records,
            );
            if (finalStatus === 'REFUNDED') counters.refunded += 1;
            else if (finalStatus === 'CONFIRMED') counters.confirmed += 1;
            else counters.pending += 1;
            continue;
        }

        if (lease.status === 'CONFIRMED') {
            const lookup = await lookupPendingPayment(apiUrl, apiKey, lease);
            if (!lookup.conclusive) {
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: lease._id, status: 'CONFIRMED' },
                    {
                        $set: {
                            lastReconciliationErrorAt: new Date(),
                            updatedAt: new Date(),
                        },
                        $unset: { reconciliationLeaseUntil: '' },
                    },
                );
                counters.pending += 1;
                continue;
            }

            if (lookup.record && isGatewayPaymentRefunded(gatewayStatus(lookup.record))) {
                if (await reconcileRefundedPayment(db, client, lease, lookup.record)) {
                    counters.refunded += 1;
                }
                continue;
            }

            if (
                !lookup.record ||
                !isGatewayPaymentConfirmed(lookup.record)
            ) {
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: lease._id, status: 'CONFIRMED' },
                    {
                        $set: {
                            gatewayState: 'PAYMENT_REVIEW_REQUIRED',
                            reconciliationReason: lookup.record
                                ? `Pagamento confirmado retornou ${gatewayStatus(lookup.record)}`
                                : 'Pagamento confirmado não foi encontrado no provedor',
                            reviewRequiredAt: new Date(),
                            updatedAt: new Date(),
                        },
                        $unset: { reconciliationLeaseUntil: '' },
                    },
                );
                counters.pending += 1;
                continue;
            }

            await db.collection('pagamentos.sessoes').updateOne(
                { _id: lease._id, status: 'CONFIRMED' },
                {
                    $set: {
                        gatewayState: gatewayStatus(lookup.record),
                        lastConfirmedReconciliationAt: new Date(),
                        updatedAt: new Date(),
                    },
                    $unset: { reconciliationLeaseUntil: '' },
                },
            );
            counters.confirmed += 1;
            continue;
        }

        if (['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'].includes(lease.status)) {
            const lookup = await lookupPendingPayment(apiUrl, apiKey, lease);

            if (!lookup.conclusive) {
                await db.collection('pagamentos.sessoes').updateOne(
                    {
                        _id: lease._id,
                        status: { $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
                    },
                    {
                        $set: {
                            lastReconciliationErrorAt: new Date(),
                            updatedAt: new Date(),
                        },
                        $unset: { reconciliationLeaseUntil: '' },
                    },
                );
                counters.pending += 1;
                continue;
            }

            if (lookup.record) {
                const status = gatewayStatus(lookup.record);
                if (isGatewayPaymentConfirmed(lookup.record)) {
                    if (await reconcileConfirmedPayment(db, client, lease, lookup.record)) {
                        counters.confirmed += 1;
                    }
                    continue;
                }
                if (isGatewayPaymentRefunded(status)) {
                    if (await reconcileRefundedPayment(db, client, lease, lookup.record)) {
                        counters.refunded += 1;
                    }
                    continue;
                }
                if (isGatewayPaymentCancelled(status)) {
                    if (await cancelUnpaidSession(db, client, lease, status)) {
                        counters.cancelled += 1;
                    }
                    continue;
                }

                const providerIsDelinquent = ['OVERDUE', 'BANK_SLIP_CANCELLED'].includes(
                    status,
                );
                let cancellationEligibleAt = lease.cancellationEligibleAt;
                if (
                    providerIsDelinquent &&
                    !Number.isFinite(new Date(String(cancellationEligibleAt || '')).getTime())
                ) {
                    cancellationEligibleAt = cancellationEligibleAtForDelinquency(
                        now,
                        getPaymentOverdueGraceDays(),
                        status === 'BANK_SLIP_CANCELLED',
                        lookup.record.dueDate,
                    );
                    await db.collection('pagamentos.sessoes').updateOne(
                        {
                            _id: lease._id,
                            status: { $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
                            $or: [
                                { cancellationEligibleAt: { $exists: false } },
                                { cancellationEligibleAt: null },
                            ],
                        },
                        {
                            $set: { cancellationEligibleAt },
                            $min: { overdueAt: now },
                        },
                    );
                }

                if (
                    providerIsDelinquent &&
                    isCancellationEligible(cancellationEligibleAt, now)
                ) {
                    const paymentId = String(lookup.record.id || lease.paymentId || '');
                    if (!paymentId) {
                        await db.collection('pagamentos.sessoes').updateOne(
                            {
                                _id: lease._id,
                                status: {
                                    $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'],
                                },
                            },
                            {
                                $set: {
                                    gatewayState: 'PAYMENT_REVIEW_REQUIRED',
                                    reconciliationReason:
                                        'Cobrança vencida elegível para encerramento sem paymentId',
                                    reviewRequiredAt: new Date(),
                                    updatedAt: new Date(),
                                },
                                $unset: { reconciliationLeaseUntil: '' },
                            },
                        );
                        counters.pending += 1;
                        continue;
                    }

                    const deletion = await deletePendingGatewayPayment(
                        apiUrl,
                        apiKey,
                        paymentId,
                    );
                    if (deletion.confirmed) {
                        if (
                            await cancelUnpaidSession(
                                db,
                                client,
                                lease,
                                'DELETED_AFTER_OVERDUE_GRACE',
                            )
                        ) {
                            counters.cancelled += 1;
                        } else {
                            counters.pending += 1;
                        }
                        continue;
                    }

                    await db.collection('pagamentos.sessoes').updateOne(
                        {
                            _id: lease._id,
                            status: { $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
                        },
                        {
                            $set: {
                                gatewayDeletionLastAttemptAt: new Date(),
                                gatewayDeletionLastStatus: deletion.status,
                                updatedAt: new Date(),
                            },
                            $unset: { reconciliationLeaseUntil: '' },
                        },
                    );
                    counters.pending += 1;
                    continue;
                }

                await runPaymentTransaction(client, async (mongoSession) => {
                    const transition = await db.collection('pagamentos.sessoes').updateOne(
                        {
                            _id: lease._id,
                            status: { $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
                        },
                        {
                            $set: {
                                gatewayState: status || lease.gatewayState || 'PENDING',
                                paymentId: lookup.record.id || lease.paymentId || null,
                                invoiceNumber:
                                    lookup.record.invoiceNumber || lease.invoiceNumber || null,
                                paymentUrl:
                                    lookup.record.invoiceUrl || lease.paymentUrl || null,
                                updatedAt: new Date(),
                            },
                            $unset: {
                                reconciliationLeaseUntil: '',
                                reconciliationEmptyChecks: '',
                            },
                        },
                        { session: mongoSession },
                    );
                    if (transition.modifiedCount !== 1) return;

                    await updatePaymentAssignment(
                        db,
                        lease._id as ObjectId,
                        'PAGAMENTO_PENDENTE',
                        {
                            metodo:
                                String(
                                    lookup.record?.billingType || lease.metodoPagamento || '',
                                ) || undefined,
                            checkoutId: String(lease.orderId || '') || undefined,
                            paymentId:
                                String(lookup.record?.id || lease.paymentId || '') || undefined,
                            invoiceNumber:
                                String(
                                    lookup.record?.invoiceNumber || lease.invoiceNumber || '',
                                ) || undefined,
                        },
                        mongoSession,
                    );
                });
                counters.pending += 1;
                continue;
            }

            const checkedPending = await db.collection('pagamentos.sessoes').findOneAndUpdate(
                {
                    _id: lease._id,
                    status: { $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
                },
                {
                    $inc: { reconciliationEmptyChecks: 1 },
                    $set: { updatedAt: new Date() },
                    $unset: { reconciliationLeaseUntil: '' },
                },
                { returnDocument: 'after' },
            );
            const safeCancellationTime =
                new Date(lease.expiresAt).getTime() + 15 * 60 * 1000;
            if (
                checkedPending &&
                Number(checkedPending.reconciliationEmptyChecks || 0) >= 2 &&
                now.getTime() >= safeCancellationTime
            ) {
                if (checkedPending.orderId) {
                    const checkoutCancellation = await requestCheckoutCancellation(
                        apiUrl,
                        apiKey,
                        String(checkedPending.orderId),
                    );
                    if (!checkoutCancellation.confirmed) {
                        await db.collection('pagamentos.sessoes').updateOne(
                            { _id: checkedPending._id },
                            {
                                $set: {
                                    gatewayState: 'CHECKOUT_CANCELLATION_UNCONFIRMED',
                                    reconciliationReason: 'CHECKOUT_CANCELLATION_UNCONFIRMED',
                                    reviewRequiredAt: new Date(),
                                    gatewayCancellationLastStatus: checkoutCancellation.status,
                                    updatedAt: new Date(),
                                },
                            },
                        );
                        counters.pending += 1;
                        continue;
                    }
                }
                if (
                    await cancelUnpaidSession(
                        db,
                        client,
                        checkedPending,
                        'NOT_FOUND_AFTER_RECONCILIATION',
                    )
                ) {
                    counters.cancelled += 1;
                }
            } else {
                counters.pending += 1;
            }
            continue;
        }

        let providerRecord: Record<string, unknown> | null = null;
        let checkoutRecord: Record<string, unknown> | null = null;
        let lookupConclusive = true;

        if (lease.paymentId) {
            providerRecord = {
                id: lease.paymentId,
                invoiceNumber: lease.invoiceNumber,
                invoiceUrl: lease.paymentUrl,
            };
        } else if (lease.orderId) {
            checkoutRecord = { id: lease.orderId, link: lease.paymentUrl };
        } else {
            const externalReference = encodeURIComponent(String(lease._id));
            const headers = asaasRequestHeaders(apiKey, { apiUrl });
            try {
                const paymentsResponse = await fetch(
                    `${apiUrl}/payments?externalReference=${externalReference}&limit=1`,
                    { headers, signal: AbortSignal.timeout(8_000) },
                );
                if (paymentsResponse.ok) {
                    providerRecord = firstGatewayItem(
                        await paymentsResponse.json().catch(() => null),
                    );
                } else {
                    lookupConclusive = false;
                }

            } catch (error) {
                lookupConclusive = false;
                console.error('Falha temporária ao consultar cobrança para conciliação:', error);
            }
        }

        if (
            providerRecord &&
            lease.installmentPlan &&
            !lease.installmentPlan.installmentId &&
            providerRecord.installment
        ) {
            const hydration = await runPaymentTransaction(client, (mongoSession) => processEvent(
                db,
                {
                    id: `reconciliation:${lease._id}:${String(providerRecord?.id || 'unknown')}:PAYMENT_CREATED`,
                    event: 'PAYMENT_CREATED',
                    payment: providerRecord,
                },
                mongoSession,
            ));
            if (hydration.requiresReview) {
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: lease._id },
                    { $unset: { reconciliationLeaseUntil: '' } },
                );
                counters.pending += 1;
                continue;
            }
            lease.installmentPlan.installmentId = String(providerRecord.installment);
        }

        if (providerRecord && isGatewayPaymentConfirmed(providerRecord)) {
            if (await reconcileConfirmedPayment(db, client, lease, providerRecord)) {
                counters.confirmed += 1;
                counters.recovered += 1;
            }
            continue;
        }
        if (providerRecord && isGatewayPaymentRefunded(gatewayStatus(providerRecord))) {
            if (await reconcileRefundedPayment(db, client, lease, providerRecord)) {
                counters.refunded += 1;
                counters.recovered += 1;
            }
            continue;
        }

        if (providerRecord || checkoutRecord) {
            await runPaymentTransaction(client, async (mongoSession) => {
                const transition = await db.collection('pagamentos.sessoes').updateOne(
                    {
                        _id: lease._id,
                        status: 'CREATING_PAYMENT',
                    },
                    {
                        $set: {
                            status: 'PAYMENT_PENDING',
                            gatewayState: 'RECONCILED',
                            paymentId: providerRecord?.id || lease.paymentId || null,
                            invoiceNumber:
                                providerRecord?.invoiceNumber || lease.invoiceNumber || null,
                            orderId: checkoutRecord?.id || lease.orderId || null,
                            paymentUrl:
                                providerRecord?.invoiceUrl ||
                                checkoutRecord?.link ||
                                lease.paymentUrl ||
                                null,
                            ...(providerRecord?.installment && lease.installmentPlan
                                ? {
                                    'installmentPlan.installmentId': String(
                                        providerRecord.installment,
                                    ),
                                }
                                : {}),
                            updatedAt: new Date(),
                        },
                        $unset: { reconciliationLeaseUntil: '' },
                    },
                    { session: mongoSession },
                );
                if (transition.modifiedCount !== 1) return;

                await updatePaymentAssignment(
                    db,
                    lease._id,
                    'PAGAMENTO_PENDENTE',
                    {
                        metodo: lease.metodoPagamento,
                        checkoutId: String(checkoutRecord?.id || lease.orderId || '') || undefined,
                        paymentId: String(providerRecord?.id || lease.paymentId || '') || undefined,
                        invoiceNumber:
                            String(providerRecord?.invoiceNumber || lease.invoiceNumber || '') ||
                            undefined,
                    },
                    mongoSession,
                );
                if (providerRecord?.installment && lease.installmentPlan) {
                    await db.collection('pagamentos.atribuicoes').updateOne(
                        { compraId: lease._id },
                        {
                            $set: {
                                'installmentPlan.installmentId': String(
                                    providerRecord.installment,
                                ),
                                updatedAt: new Date(),
                            },
                        },
                        { session: mongoSession },
                    );
                }
                await db.collection('usuarios').updateOne(
                    { _id: lease.owner, 'pagamento.situacao': { $ne: 1 } },
                    { $set: { 'pagamento.situacao': 2 } },
                    { session: mongoSession },
                );
            });
            counters.recovered += 1;
            continue;
        }

        if (!lookupConclusive) {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: lease._id, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        lastReconciliationErrorAt: new Date(),
                        updatedAt: new Date(),
                    },
                    $unset: { reconciliationLeaseUntil: '' },
                },
            );
            counters.pending += 1;
            continue;
        }

        const checked = await db.collection('pagamentos.sessoes').findOneAndUpdate(
            { _id: lease._id, status: 'CREATING_PAYMENT' },
            {
                $inc: { reconciliationEmptyChecks: 1 },
                $unset: { reconciliationLeaseUntil: '' },
                $set: { updatedAt: new Date() },
            },
            { returnDocument: 'after' },
        );
        const safeCancellationTime = new Date(lease.expiresAt).getTime() + 15 * 60 * 1000;
        if (
            checked &&
            Number(checked.reconciliationEmptyChecks || 0) >= 2 &&
            now.getTime() >= safeCancellationTime
        ) {
            await runPaymentTransaction(client, async (mongoSession) => {
                const transition = await db.collection('pagamentos.sessoes').updateOne(
                    { _id: lease._id, status: 'CREATING_PAYMENT' },
                    {
                        $set: {
                            status: 'CANCELLED',
                            gatewayState: 'NOT_FOUND_AFTER_RECONCILIATION',
                            terminalAt: new Date(),
                            updatedAt: new Date(),
                        },
                        $unset: { activeKey: '', reconciliationLeaseUntil: '' },
                    },
                    { session: mongoSession },
                );
                if (transition.modifiedCount !== 1) return;
                await releaseDiscountReservation(db, lease._id as ObjectId, mongoSession);
                await updatePaymentAssignment(
                    db,
                    lease._id as ObjectId,
                    'CANCELADA',
                    undefined,
                    mongoSession,
                );
            });
            counters.cancelled += 1;
        } else {
            counters.pending += 1;
        }
        } catch (error) {
            console.error(`Falha ao conciliar a compra ${String(lease._id)}:`, error);
            await db.collection('pagamentos.sessoes').updateOne(
                {
                    _id: lease._id,
                    status: {
                        $in: [
                            'CREATING_PAYMENT',
                            'PAYMENT_PENDING',
                            'PAYMENT_REVIEW_REQUIRED',
                            'CONFIRMED',
                        ],
                    },
                },
                {
                    $set: {
                        lastReconciliationErrorAt: new Date(),
                        lastReconciliationError:
                            error instanceof Error
                                ? error.message.slice(0, 500)
                                : 'unknown_error',
                        updatedAt: new Date(),
                    },
                    $unset: { reconciliationLeaseUntil: '' },
                },
            );
            counters.pending += 1;
        }
    }

    return Response.json(counters, { status: 200 });
}
