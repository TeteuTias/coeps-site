import { timingSafeEqual } from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
    consumeDiscountCode,
    releaseDiscountReservation,
    updatePaymentAssignment,
    updateUserRegistrationAfterRefund,
} from '@/lib/payments/codes';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import {
    cancellationEligibleAtForDelinquency,
    gatewayDeletionWasConfirmed,
    getPaymentOverdueGraceDays,
    isCancellationEligible,
} from '@/lib/payments/overdue';

function secureEquals(received: string | null, expected: string | undefined): boolean {
    if (!received || !expected) return false;
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    return (
        receivedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(receivedBuffer, expectedBuffer)
    );
}

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

function isGatewayPaymentConfirmed(status: string): boolean {
    return ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status);
}

function isGatewayPaymentRefunded(status: string): boolean {
    return ['REFUNDED', 'CHARGEBACK_DISPUTE_LOST'].includes(status);
}

function isGatewayPaymentCancelled(status: string): boolean {
    return ['DELETED', 'CANCELLED', 'CANCELED'].includes(status);
}

async function lookupPendingPayment(
    apiUrl: string,
    apiKey: string,
    paymentSession: Record<string, unknown>,
): Promise<{ conclusive: boolean; record: Record<string, unknown> | null }> {
    const headers = { accept: 'application/json', access_token: apiKey };
    const paymentId = typeof paymentSession.paymentId === 'string'
        ? paymentSession.paymentId
        : null;
    const url = paymentId
        ? `${apiUrl}/payments/${encodeURIComponent(paymentId)}`
        : `${apiUrl}/payments?externalReference=${encodeURIComponent(String(paymentSession._id))}&limit=1`;

    try {
        const response = await fetch(url, { headers });
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
                headers: { accept: 'application/json', access_token: apiKey },
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

async function confirmPendingPayment(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    client: Awaited<ReturnType<typeof connectToDatabase>>['client'],
    paymentSession: Record<string, any>,
    payment: Record<string, any>,
): Promise<boolean> {
    return runPaymentTransaction(client, async (mongoSession) => {
        const now = new Date();
        const transition = await db.collection('pagamentos.sessoes').updateOne(
            {
                _id: paymentSession._id,
                status: { $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
            },
            {
                $set: {
                    status: 'CONFIRMED',
                    gatewayState: gatewayStatus(payment),
                    paymentId: payment.id || paymentSession.paymentId || null,
                    invoiceNumber: payment.invoiceNumber || paymentSession.invoiceNumber || null,
                    paymentUrl: payment.invoiceUrl || paymentSession.paymentUrl || null,
                    confirmedAt: now,
                    updatedAt: now,
                },
                $unset: { activeKey: '', reconciliationLeaseUntil: '' },
            },
            { session: mongoSession },
        );
        if (transition.modifiedCount !== 1) return false;

        await db.collection('usuarios').updateOne(
            { _id: paymentSession.owner },
            {
                $set: {
                    'pagamento.situacao': 1,
                    'pagamento.tipo_pagamento': 'asaas',
                    'pagamento.edicaoId': paymentSession.edicaoId,
                    'pagamento.compraId': paymentSession._id,
                },
            },
            { session: mongoSession },
        );
        await updatePaymentAssignment(
            db,
            paymentSession._id as ObjectId,
            'CONFIRMADA',
            {
                metodo: String(payment.billingType || paymentSession.metodoPagamento || '') || undefined,
                checkoutId: String(payment.checkoutSession || paymentSession.orderId || '') || undefined,
                paymentId: String(payment.id || paymentSession.paymentId || '') || undefined,
                invoiceNumber:
                    String(payment.invoiceNumber || paymentSession.invoiceNumber || '') || undefined,
            },
            mongoSession,
        );
        await db.collection('pagamentos.comprovantes').updateOne(
            { compraId: paymentSession._id },
            {
                $setOnInsert: {
                    compraId: paymentSession._id,
                    owner: paymentSession.owner,
                    type: 'ticket',
                    title: 'EM BREVE!',
                    createdAt: now,
                },
                $set: { status: 'PAID', updatedAt: now },
            },
            { upsert: true, session: mongoSession },
        );
        const discountConsumed = await consumeDiscountCode(
            db,
            paymentSession._id as ObjectId,
            mongoSession,
            paymentSession.codigoDesconto?.codigoId,
        );
        if (paymentSession.codigoDesconto && !discountConsumed) {
            throw new Error('A conciliação não conseguiu marcar o desconto como usado.');
        }
        return true;
    });
}

async function refundPendingPayment(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    client: Awaited<ReturnType<typeof connectToDatabase>>['client'],
    paymentSession: Record<string, any>,
): Promise<boolean> {
    return runPaymentTransaction(client, async (mongoSession) => {
        const now = new Date();
        const transition = await db.collection('pagamentos.sessoes').updateOne(
            {
                _id: paymentSession._id,
                status: {
                    $in: ['PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED', 'CONFIRMED'],
                },
            },
            {
                $set: {
                    status: 'REFUNDED',
                    refundStatus: 'FULL',
                    terminalAt: now,
                    updatedAt: now,
                },
                $unset: { activeKey: '', reconciliationLeaseUntil: '' },
            },
            { session: mongoSession },
        );
        if (transition.modifiedCount !== 1) return false;

        await updatePaymentAssignment(
            db,
            paymentSession._id as ObjectId,
            'ESTORNADA',
            undefined,
            mongoSession,
        );
        const discountConsumed = await consumeDiscountCode(
            db,
            paymentSession._id as ObjectId,
            mongoSession,
            paymentSession.codigoDesconto?.codigoId,
        );
        if (paymentSession.codigoDesconto && !discountConsumed) {
            throw new Error('A conciliação não conseguiu preservar o consumo do desconto.');
        }
        await updateUserRegistrationAfterRefund(
            db,
            paymentSession.owner,
            paymentSession.edicaoId,
            paymentSession._id,
            mongoSession,
        );
        await db.collection('pagamentos.comprovantes').updateOne(
            { compraId: paymentSession._id },
            { $set: { status: 'REFUNDED', refundedAt: now, updatedAt: now } },
            { session: mongoSession },
        );
        return true;
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
    const expectedSecret = process.env.PAYMENT_RECONCILIATION_SECRET;
    const receivedSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
    if (!secureEquals(receivedSecret, expectedSecret)) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const apiUrl = process.env.ASAAS_API_URL;
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiUrl || !apiKey) {
        return Response.json({ error: 'payment_gateway_not_configured' }, { status: 503 });
    }

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
        inspected: 0,
        recovered: 0,
        confirmed: 0,
        refunded: 0,
        cancelled: 0,
        pending: 0,
    };

    for (const candidate of candidates) {
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
                if (await refundPendingPayment(db, client, lease)) {
                    counters.refunded += 1;
                }
                continue;
            }

            if (
                !lookup.record ||
                !isGatewayPaymentConfirmed(gatewayStatus(lookup.record))
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
                if (isGatewayPaymentConfirmed(status)) {
                    if (await confirmPendingPayment(db, client, lease, lookup.record)) {
                        counters.confirmed += 1;
                    }
                    continue;
                }
                if (isGatewayPaymentRefunded(status)) {
                    if (await refundPendingPayment(db, client, lease)) {
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
            const headers = { accept: 'application/json', access_token: apiKey };
            try {
                const paymentsResponse = await fetch(
                    `${apiUrl}/payments?externalReference=${externalReference}&limit=1`,
                    { headers },
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
