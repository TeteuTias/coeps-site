import {
    ObjectId,
    type ClientSession,
    type Db,
    type Document,
    type MongoClient,
} from 'mongodb';
import {
    checkoutPaymentIsCorrelated,
    lookupCheckoutPayments,
    paymentPreventsCheckoutCancellation,
    requestCheckoutCancellation,
} from './checkout-cancellation.ts';
import {
    releaseDiscountReservation,
    updatePaymentAssignment,
} from './codes.ts';
import { runPaymentTransaction } from './transactions.ts';

const CANCELLATION_LEASE_MS = 45_000;

export type PurchaseCancellationStatus =
    | 'CANCELLING'
    | 'RETRYABLE'
    | 'REVIEW_REQUIRED'
    | 'PAYMENT_DETECTED'
    | 'COMPLETED';

export type PurchaseCancellationResult =
    | { kind: 'completed'; session: Document; message: string }
    | { kind: 'pending'; code: 'purchase_cancellation_pending'; message: string }
    | { kind: 'payment_detected'; code: 'pix_payment_detected'; message: string }
    | { kind: 'not_allowed'; code: 'payment_session_not_cancellable'; message: string }
    | { kind: 'not_found'; code: 'payment_session_not_found'; message: string };

type CancellationDependencies = {
    db: Db;
    client: MongoClient;
    owner: ObjectId;
    sessionId: ObjectId;
    apiUrl?: string;
    apiKey?: string;
    fetcher?: typeof fetch;
    now?: Date;
};

type AcquiredCancellation = {
    kind: 'acquired';
    session: Document;
};

function hasActivePaymentMethodSwitch(session: Document): boolean {
    return (
        session.paymentMethodSwitch?.target === 'CREDIT_CARD' &&
        ['CANCELLING', 'RETRYABLE', 'REVIEW_REQUIRED', 'PAYMENT_DETECTED']
            .includes(String(session.paymentMethodSwitch?.status || ''))
    );
}

async function setCancellationState(
    db: Db,
    owner: ObjectId,
    sessionId: ObjectId,
    status: PurchaseCancellationStatus,
    now: Date,
    fields: Record<string, unknown> = {},
): Promise<void> {
    await db.collection('pagamentos.sessoes').updateOne(
        {
            _id: sessionId,
            owner,
            'purchaseCancellation.status': { $ne: 'COMPLETED' },
        },
        {
            $set: {
                'purchaseCancellation.status': status,
                'purchaseCancellation.updatedAt': now,
                ...fields,
                updatedAt: now,
            },
            $unset: { 'purchaseCancellation.leaseUntil': '' },
        },
    );
}

async function completePurchaseCancellation(
    db: Db,
    owner: ObjectId,
    sessionId: ObjectId,
    mongoSession: ClientSession,
    gatewayState: string,
    now: Date,
): Promise<Document> {
    const current = await db.collection('pagamentos.sessoes').findOne(
        { _id: sessionId, owner, type: 'ticket' },
        { session: mongoSession },
    );
    if (!current) throw new Error('PURCHASE_CANCELLATION_SESSION_NOT_FOUND');

    if (
        current.status === 'CANCELLED' &&
        current.purchaseCancellation?.status === 'COMPLETED'
    ) {
        return current;
    }

    const isOpenWithoutCharge = (
        current.status === 'OPEN' &&
        !current.orderId &&
        !current.paymentId
    );
    const isConfirmedPixCancellation = (
        current.status === 'PAYMENT_PENDING' &&
        current.metodoPagamento === 'PIX' &&
        Boolean(current.orderId) &&
        Boolean(current.purchaseCancellation?.gatewayCancellationConfirmedAt)
    );
    if (!isOpenWithoutCharge && !isConfirmedPixCancellation) {
        throw new Error('PURCHASE_CANCELLATION_SESSION_NOT_ELIGIBLE');
    }

    const transition = await db.collection('pagamentos.sessoes').updateOne(
        {
            _id: sessionId,
            owner,
            status: current.status,
            'purchaseCancellation.status': {
                $in: ['CANCELLING', 'RETRYABLE', 'REVIEW_REQUIRED'],
            },
        },
        {
            $set: {
                status: 'CANCELLED',
                gatewayState,
                terminalAt: now,
                updatedAt: now,
                'purchaseCancellation.status': 'COMPLETED',
                'purchaseCancellation.completedAt': now,
                'purchaseCancellation.updatedAt': now,
            },
            $unset: {
                activeKey: '',
                'purchaseCancellation.leaseUntil': '',
            },
        },
        { session: mongoSession },
    );
    if (transition.modifiedCount !== 1) {
        throw new Error('PURCHASE_CANCELLATION_TRANSITION_FAILED');
    }

    const assignmentUpdated = await updatePaymentAssignment(
        db,
        sessionId,
        'CANCELADA',
        undefined,
        mongoSession,
    );
    if (!assignmentUpdated) {
        throw new Error('PURCHASE_CANCELLATION_ASSIGNMENT_NOT_FOUND');
    }

    if (current.codigoDesconto) {
        const discountReleased = await releaseDiscountReservation(
            db,
            sessionId,
            mongoSession,
        );
        if (!discountReleased) {
            throw new Error('PURCHASE_CANCELLATION_DISCOUNT_NOT_FOUND');
        }
    }

    await db.collection('usuarios').updateOne(
        { _id: owner, 'pagamento.situacao': { $ne: 1 } },
        { $set: { 'pagamento.situacao': 0 } },
        { session: mongoSession },
    );

    return {
        ...current,
        status: 'CANCELLED',
        gatewayState,
        terminalAt: now,
        updatedAt: now,
        purchaseCancellation: {
            ...current.purchaseCancellation,
            status: 'COMPLETED',
            completedAt: now,
            updatedAt: now,
        },
    };
}

async function acquireCancellationIntent(
    db: Db,
    owner: ObjectId,
    sessionId: ObjectId,
    now: Date,
): Promise<AcquiredCancellation | PurchaseCancellationResult> {
    const existing = await db.collection('pagamentos.sessoes').findOne({
        _id: sessionId,
        owner,
        type: 'ticket',
    });
    if (!existing) {
        return {
            kind: 'not_found',
            code: 'payment_session_not_found',
            message: 'Sessão de pagamento não encontrada.',
        };
    }

    if (
        existing.status === 'CANCELLED' &&
        existing.purchaseCancellation?.status === 'COMPLETED'
    ) {
        return {
            kind: 'completed',
            session: existing,
            message: 'Compra cancelada com sucesso.',
        };
    }

    if (existing.purchaseCancellation?.status === 'PAYMENT_DETECTED') {
        return {
            kind: 'payment_detected',
            code: 'pix_payment_detected',
            message: 'Um pagamento PIX foi identificado. Aguarde a confirmação antes de sair.',
        };
    }

    if (
        existing.purchaseCancellation?.status === 'REVIEW_REQUIRED' &&
        !existing.purchaseCancellation?.gatewayCancellationConfirmedAt
    ) {
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'O cancelamento ainda precisa ser verificado. Sua vaga continua reservada.',
        };
    }

    if (hasActivePaymentMethodSwitch(existing)) {
        return {
            kind: 'not_allowed',
            code: 'payment_session_not_cancellable',
            message: 'A troca do PIX para cartão já está em andamento.',
        };
    }

    const isOpenWithoutCharge = (
        existing.status === 'OPEN' &&
        !existing.orderId &&
        !existing.paymentId
    );
    const isPendingPix = (
        existing.status === 'PAYMENT_PENDING' &&
        existing.metodoPagamento === 'PIX' &&
        typeof existing.orderId === 'string'
    );
    if (!isOpenWithoutCharge && !isPendingPix) {
        return {
            kind: 'not_allowed',
            code: 'payment_session_not_cancellable',
            message: 'Esta sessão não pode ser cancelada por este fluxo.',
        };
    }

    const acquired = await db.collection('pagamentos.sessoes').findOneAndUpdate(
        {
            _id: sessionId,
            owner,
            type: 'ticket',
            status: existing.status,
            $and: [
                {
                    $or: [
                        { 'purchaseCancellation.leaseUntil': { $exists: false } },
                        { 'purchaseCancellation.leaseUntil': { $lte: now } },
                    ],
                },
                {
                    $or: [
                        { paymentMethodSwitch: { $exists: false } },
                        { 'paymentMethodSwitch.status': 'COMPLETED' },
                    ],
                },
            ],
        },
        {
            $set: {
                'purchaseCancellation.status': 'CANCELLING',
                'purchaseCancellation.requestedAt':
                    existing.purchaseCancellation?.requestedAt || now,
                'purchaseCancellation.updatedAt': now,
                'purchaseCancellation.leaseUntil':
                    new Date(now.getTime() + CANCELLATION_LEASE_MS),
                updatedAt: now,
            },
            $unset: {
                'purchaseCancellation.reason': '',
                'purchaseCancellation.lastGatewayStatus': '',
            },
        },
        { returnDocument: 'after' },
    );
    if (!acquired) {
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'O cancelamento já está sendo processado.',
        };
    }
    return { kind: 'acquired', session: acquired };
}

async function finishLocally(
    dependencies: CancellationDependencies,
    gatewayState: string,
    now: Date,
): Promise<PurchaseCancellationResult> {
    try {
        const cancelled = await runPaymentTransaction(
            dependencies.client,
            (mongoSession) => completePurchaseCancellation(
                dependencies.db,
                dependencies.owner,
                dependencies.sessionId,
                mongoSession,
                gatewayState,
                now,
            ),
        );
        return {
            kind: 'completed',
            session: cancelled,
            message: 'Compra cancelada com sucesso.',
        };
    } catch (error) {
        await setCancellationState(
            dependencies.db,
            dependencies.owner,
            dependencies.sessionId,
            gatewayState === 'CHECKOUT_CANCELLED_BY_USER'
                ? 'REVIEW_REQUIRED'
                : 'RETRYABLE',
            now,
            {
                'purchaseCancellation.reason': 'LOCAL_CANCELLATION_TRANSACTION_FAILED',
            },
        );
        console.error('Falha ao concluir cancelamento da compra:', error);
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'O cancelamento está sendo conciliado. Sua vaga continua reservada por segurança.',
        };
    }
}

export async function cancelPaymentSession(
    dependencies: CancellationDependencies,
): Promise<PurchaseCancellationResult> {
    const now = dependencies.now ?? new Date();
    const fetcher = dependencies.fetcher ?? fetch;
    const intent = await acquireCancellationIntent(
        dependencies.db,
        dependencies.owner,
        dependencies.sessionId,
        now,
    );
    if (intent.kind !== 'acquired') return intent;

    const paymentSession = intent.session;
    if (paymentSession.status === 'OPEN') {
        return finishLocally(
            dependencies,
            'USER_CANCELLED_BEFORE_PAYMENT',
            now,
        );
    }

    if (paymentSession.purchaseCancellation?.gatewayCancellationConfirmedAt) {
        return finishLocally(
            dependencies,
            'CHECKOUT_CANCELLED_BY_USER',
            now,
        );
    }

    if (!dependencies.apiUrl || !dependencies.apiKey) {
        await setCancellationState(
            dependencies.db,
            dependencies.owner,
            dependencies.sessionId,
            'RETRYABLE',
            now,
            {
                'purchaseCancellation.reason': 'PAYMENT_GATEWAY_NOT_CONFIGURED',
            },
        );
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'O cancelamento não pôde ser confirmado agora. Sua vaga continua reservada.',
        };
    }

    const checkoutId = String(paymentSession.orderId);
    const preflight = await lookupCheckoutPayments(
        dependencies.apiUrl,
        dependencies.apiKey,
        checkoutId,
        fetcher,
    );
    if (!preflight.conclusive) {
        await setCancellationState(
            dependencies.db,
            dependencies.owner,
            dependencies.sessionId,
            'RETRYABLE',
            now,
            {
                'purchaseCancellation.reason': 'PAYMENT_LOOKUP_UNAVAILABLE',
                'purchaseCancellation.lastGatewayStatus': preflight.status,
            },
        );
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'Estamos verificando o PIX. A cobrança e sua vaga continuam reservadas.',
        };
    }

    const sessionId = dependencies.sessionId.toHexString();
    const mismatchedPayment = preflight.payments.some((payment) =>
        !checkoutPaymentIsCorrelated(payment, sessionId, checkoutId));
    const blockingPayment = preflight.payments.some(paymentPreventsCheckoutCancellation);
    if (mismatchedPayment || blockingPayment) {
        await setCancellationState(
            dependencies.db,
            dependencies.owner,
            dependencies.sessionId,
            'PAYMENT_DETECTED',
            now,
            {
                'purchaseCancellation.reason': mismatchedPayment
                    ? 'PAYMENT_CORRELATION_MISMATCH'
                    : 'PAYMENT_ALREADY_IN_PROGRESS',
            },
        );
        return {
            kind: 'payment_detected',
            code: 'pix_payment_detected',
            message: 'Um pagamento PIX foi identificado. Aguarde a confirmação antes de sair.',
        };
    }

    const cancellation = await requestCheckoutCancellation(
        dependencies.apiUrl,
        dependencies.apiKey,
        checkoutId,
        fetcher,
    );
    if (cancellation.status === null || cancellation.retryable) {
        await setCancellationState(
            dependencies.db,
            dependencies.owner,
            dependencies.sessionId,
            'RETRYABLE',
            now,
            {
                'purchaseCancellation.reason': cancellation.status === null
                    ? 'CHECKOUT_CANCELLATION_TIMEOUT'
                    : 'CHECKOUT_CANCELLATION_RETRYABLE',
                'purchaseCancellation.lastGatewayStatus': cancellation.status,
            },
        );
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'Estamos confirmando o cancelamento do PIX. Sua vaga continua reservada.',
        };
    }

    if (!cancellation.confirmed) {
        const afterFailure = await lookupCheckoutPayments(
            dependencies.apiUrl,
            dependencies.apiKey,
            checkoutId,
            fetcher,
        );
        const paymentDetected = afterFailure.payments.some((payment) =>
            !checkoutPaymentIsCorrelated(payment, sessionId, checkoutId) ||
            paymentPreventsCheckoutCancellation(payment));
        await setCancellationState(
            dependencies.db,
            dependencies.owner,
            dependencies.sessionId,
            paymentDetected ? 'PAYMENT_DETECTED' : 'REVIEW_REQUIRED',
            now,
            {
                'purchaseCancellation.reason': paymentDetected
                    ? 'PAYMENT_DETECTED_AFTER_CANCELLATION_FAILURE'
                    : 'CHECKOUT_CANCELLATION_UNCONFIRMED',
                'purchaseCancellation.lastGatewayStatus': cancellation.status,
            },
        );
        if (paymentDetected) {
            return {
                kind: 'payment_detected',
                code: 'pix_payment_detected',
                message: 'Um pagamento PIX foi identificado. Aguarde a confirmação.',
            };
        }
        return {
            kind: 'pending',
            code: 'purchase_cancellation_pending',
            message: 'O cancelamento ainda precisa ser verificado. Sua vaga continua reservada.',
        };
    }

    const confirmedAt = new Date();
    await dependencies.db.collection('pagamentos.sessoes').updateOne(
        {
            _id: dependencies.sessionId,
            owner: dependencies.owner,
            status: 'PAYMENT_PENDING',
            'purchaseCancellation.status': 'CANCELLING',
        },
        {
            $set: {
                'purchaseCancellation.gatewayCancellationConfirmedAt': confirmedAt,
                'purchaseCancellation.updatedAt': confirmedAt,
                updatedAt: confirmedAt,
            },
        },
    );
    return finishLocally(
        dependencies,
        'CHECKOUT_CANCELLED_BY_USER',
        confirmedAt,
    );
}
