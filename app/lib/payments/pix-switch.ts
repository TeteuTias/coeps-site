import {
    ObjectId,
    type ClientSession,
    type Db,
    type Document,
    type MongoClient,
} from 'mongodb';
import {
    PAYMENT_ASSIGNMENTS_COLLECTION,
    transferDiscountReservation,
    updatePaymentAssignment,
} from './codes.ts';
import {
    checkoutPaymentIsCorrelated,
    lookupCheckoutPayments,
    paymentPreventsCheckoutCancellation,
    requestCheckoutCancellation,
} from './checkout-cancellation.ts';
import { runPaymentTransaction } from './transactions.ts';

const SWITCH_LEASE_MS = 45_000;
const REPLACEMENT_SESSION_MS = 15 * 60_000;

export type PixSwitchStatus =
    | 'CANCELLING'
    | 'RETRYABLE'
    | 'REVIEW_REQUIRED'
    | 'PAYMENT_DETECTED'
    | 'COMPLETED';

export type PixSwitchResult =
    | { kind: 'completed'; session: Document }
    | { kind: 'pending'; code: 'pix_switch_pending'; message: string }
    | { kind: 'payment_detected'; code: 'pix_payment_detected'; message: string }
    | { kind: 'not_allowed'; code: 'pix_switch_not_allowed'; message: string }
    | { kind: 'not_found'; code: 'payment_session_not_found'; message: string };

type SwitchDependencies = {
    db: Db;
    client: MongoClient;
    owner: ObjectId;
    sessionId: ObjectId;
    apiUrl: string;
    apiKey: string;
    fetcher?: typeof fetch;
    now?: Date;
};

async function setSwitchState(
    db: Db,
    sessionId: ObjectId,
    status: PixSwitchStatus,
    now: Date,
    fields: Record<string, unknown> = {},
): Promise<void> {
    await db.collection('pagamentos.sessoes').updateOne(
        {
            _id: sessionId,
            'paymentMethodSwitch.target': 'CREDIT_CARD',
            'paymentMethodSwitch.status': { $ne: 'COMPLETED' },
        },
        {
            $set: {
                'paymentMethodSwitch.status': status,
                'paymentMethodSwitch.updatedAt': now,
                ...fields,
                updatedAt: now,
            },
            $unset: { 'paymentMethodSwitch.leaseUntil': '' },
        },
    );
}

export async function completePixToCardSwitch(
    db: Db,
    sessionId: ObjectId,
    mongoSession: ClientSession,
    gatewayState: string,
    now = new Date(),
): Promise<Document> {
    const current = await db.collection('pagamentos.sessoes').findOne(
        { _id: sessionId },
        { session: mongoSession },
    );
    if (!current) throw new Error('PIX_SWITCH_SESSION_NOT_FOUND');

    const replacementIdValue = current.paymentMethodSwitch?.replacementSessionId;
    if (!replacementIdValue || !ObjectId.isValid(String(replacementIdValue))) {
        throw new Error('PIX_SWITCH_REPLACEMENT_ID_MISSING');
    }
    const replacementId = new ObjectId(String(replacementIdValue));

    if (current.paymentMethodSwitch?.status === 'COMPLETED') {
        const existingReplacement = await db.collection('pagamentos.sessoes').findOne(
            { _id: replacementId, previousSessionId: sessionId },
            { session: mongoSession },
        );
        if (!existingReplacement) throw new Error('PIX_SWITCH_REPLACEMENT_SESSION_MISSING');
        return existingReplacement;
    }

    if (
        current.status !== 'PAYMENT_PENDING' ||
        current.metodoPagamento !== 'PIX' ||
        !current.orderId ||
        current.paymentMethodSwitch?.target !== 'CREDIT_CARD'
    ) {
        throw new Error('PIX_SWITCH_SESSION_NOT_ELIGIBLE');
    }

    const expiresAt = new Date(now.getTime() + REPLACEMENT_SESSION_MS);
    const owner = current.owner instanceof ObjectId
        ? current.owner
        : new ObjectId(String(current.owner));
    const activeKey = `${String(current.edicaoId)}:${owner.toHexString()}:ticket`;

    const oldTransition = await db.collection('pagamentos.sessoes').updateOne(
        {
            _id: sessionId,
            status: 'PAYMENT_PENDING',
            metodoPagamento: 'PIX',
            'paymentMethodSwitch.target': 'CREDIT_CARD',
            'paymentMethodSwitch.replacementSessionId': replacementId,
            'paymentMethodSwitch.status': { $ne: 'COMPLETED' },
        },
        {
            $set: {
                status: 'CANCELLED',
                gatewayState,
                terminalAt: now,
                updatedAt: now,
                'paymentMethodSwitch.status': 'COMPLETED',
                'paymentMethodSwitch.completedAt': now,
                'paymentMethodSwitch.updatedAt': now,
            },
            $unset: {
                activeKey: '',
                'paymentMethodSwitch.leaseUntil': '',
            },
        },
        { session: mongoSession },
    );
    if (oldTransition.modifiedCount !== 1) {
        throw new Error('PIX_SWITCH_OLD_SESSION_TRANSITION_FAILED');
    }

    const oldAssignmentUpdated = await updatePaymentAssignment(
        db,
        sessionId,
        'CANCELADA',
        undefined,
        mongoSession,
    );
    if (!oldAssignmentUpdated) throw new Error('PIX_SWITCH_OLD_ASSIGNMENT_MISSING');

    if (current.codigoDesconto) {
        const discountTransferred = await transferDiscountReservation(
            db,
            sessionId,
            replacementId,
            owner,
            expiresAt,
            mongoSession,
        );
        if (!discountTransferred) throw new Error('PIX_SWITCH_DISCOUNT_TRANSFER_FAILED');
    }

    const replacementSession = {
        _id: replacementId,
        activeKey,
        previousSessionId: sessionId,
        owner,
        edicaoId: current.edicaoId,
        type: 'ticket',
        status: 'OPEN',
        metodoPagamento: 'CREDIT_CARD',
        expiresAt,
        createdAt: now,
        updatedAt: now,
        gatewayState: 'CREATED_AFTER_PIX_CANCELLATION',
        paymentConfigOriginal: current.paymentConfigOriginal,
        paymentConfig: current.paymentConfig,
        valoresCentavos: current.valoresCentavos,
        metodosPagamentoPermitidos: current.metodosPagamentoPermitidos,
        codigoDesconto: current.codigoDesconto,
        codigoRastreio: current.codigoRastreio,
        orderId: null,
        paymentId: null,
        invoiceNumber: null,
        paymentUrl: null,
        pixCode: null,
        checkoutExpiresAt: null,
        userProps: current.userProps,
    };
    await db.collection('pagamentos.sessoes').insertOne(replacementSession, {
        session: mongoSession,
    });

    await db.collection(PAYMENT_ASSIGNMENTS_COLLECTION).insertOne(
        {
            compraId: replacementId,
            edicaoId: current.edicaoId,
            usuarioId: owner,
            codigoDesconto: current.codigoDesconto,
            codigoRastreio: current.codigoRastreio,
            valoresCentavos: current.valoresCentavos,
            status: 'ABERTA',
            previousPurchaseId: sessionId,
            createdAt: now,
            updatedAt: now,
        },
        { session: mongoSession },
    );

    await db.collection('usuarios').updateOne(
        { _id: owner, 'pagamento.situacao': { $ne: 1 } },
        { $set: { 'pagamento.situacao': 0 } },
        { session: mongoSession },
    );
    return replacementSession;
}

async function acquireSwitchIntent(
    db: Db,
    owner: ObjectId,
    sessionId: ObjectId,
    now: Date,
): Promise<{ kind: 'acquired'; session: Document } | PixSwitchResult> {
    const existing = await db.collection('pagamentos.sessoes').findOne({
        _id: sessionId,
        owner,
        type: 'ticket',
    });
    if (!existing) {
        return { kind: 'not_found', code: 'payment_session_not_found', message: 'SessÃ£o nÃ£o encontrada.' };
    }

    if (existing.paymentMethodSwitch?.status === 'COMPLETED') {
        const replacementId = existing.paymentMethodSwitch?.replacementSessionId;
        const replacement = replacementId
            ? await db.collection('pagamentos.sessoes').findOne({ _id: new ObjectId(String(replacementId)), owner })
            : null;
        if (replacement) return { kind: 'completed', session: replacement };
    }

    if (
        existing.status !== 'PAYMENT_PENDING' ||
        existing.metodoPagamento !== 'PIX' ||
        !existing.orderId ||
        !Array.isArray(existing.metodosPagamentoPermitidos) ||
        !existing.metodosPagamentoPermitidos.includes('CREDIT_CARD')
    ) {
        return {
            kind: 'not_allowed',
            code: 'pix_switch_not_allowed',
            message: 'Esta sessÃ£o PIX nÃ£o pode ser trocada por cartÃ£o.',
        };
    }

    if (['PAYMENT_DETECTED', 'REVIEW_REQUIRED'].includes(existing.paymentMethodSwitch?.status)) {
        return existing.paymentMethodSwitch?.status === 'PAYMENT_DETECTED'
            ? {
                kind: 'payment_detected',
                code: 'pix_payment_detected',
                message: 'Um pagamento PIX foi identificado. Aguarde a confirmaÃ§Ã£o.',
            }
            : {
                kind: 'pending',
                code: 'pix_switch_pending',
                message: 'O cancelamento do PIX ainda precisa ser verificado.',
            };
    }

    const replacementSessionId = existing.paymentMethodSwitch?.replacementSessionId &&
        ObjectId.isValid(String(existing.paymentMethodSwitch.replacementSessionId))
        ? new ObjectId(String(existing.paymentMethodSwitch.replacementSessionId))
        : new ObjectId();
    const acquired = await db.collection('pagamentos.sessoes').findOneAndUpdate(
        {
            _id: sessionId,
            owner,
            status: 'PAYMENT_PENDING',
            metodoPagamento: 'PIX',
            orderId: { $type: 'string' },
            $and: [
                {
                    $or: [
                        { 'paymentMethodSwitch.leaseUntil': { $exists: false } },
                        { 'paymentMethodSwitch.leaseUntil': { $lte: now } },
                    ],
                },
                {
                    $or: [
                        { purchaseCancellation: { $exists: false } },
                        { 'purchaseCancellation.status': 'COMPLETED' },
                    ],
                },
            ],
        },
        {
            $set: {
                paymentMethodSwitch: {
                    target: 'CREDIT_CARD',
                    status: 'CANCELLING',
                    replacementSessionId,
                    requestedAt: existing.paymentMethodSwitch?.requestedAt || now,
                    updatedAt: now,
                    leaseUntil: new Date(now.getTime() + SWITCH_LEASE_MS),
                },
                updatedAt: now,
            },
        },
        { returnDocument: 'after' },
    );
    if (!acquired) {
        return {
            kind: 'pending',
            code: 'pix_switch_pending',
            message: 'O cancelamento do PIX jÃ¡ estÃ¡ sendo processado.',
        };
    }
    return { kind: 'acquired', session: acquired };
}

export async function switchPixSessionToCreditCard(
    dependencies: SwitchDependencies,
): Promise<PixSwitchResult> {
    const now = dependencies.now ?? new Date();
    const fetcher = dependencies.fetcher ?? fetch;
    const intent = await acquireSwitchIntent(
        dependencies.db,
        dependencies.owner,
        dependencies.sessionId,
        now,
    );
    if (intent.kind !== 'acquired') return intent;

    const checkoutId = String(intent.session.orderId);
    const preflight = await lookupCheckoutPayments(
        dependencies.apiUrl,
        dependencies.apiKey,
        checkoutId,
        fetcher,
    );
    if (!preflight.conclusive) {
        await setSwitchState(dependencies.db, dependencies.sessionId, 'RETRYABLE', now, {
            'paymentMethodSwitch.reason': 'PAYMENT_LOOKUP_UNAVAILABLE',
            'paymentMethodSwitch.lastGatewayStatus': preflight.status,
        });
        return {
            kind: 'pending',
            code: 'pix_switch_pending',
            message: 'Estamos verificando o PIX. A cobranÃ§a e sua vaga continuam reservadas.',
        };
    }

    const sessionId = dependencies.sessionId.toHexString();
    const mismatchedPayment = preflight.payments.some((payment) =>
        !checkoutPaymentIsCorrelated(payment, sessionId, checkoutId));
    const blockingPayment = preflight.payments.some(paymentPreventsCheckoutCancellation);
    if (mismatchedPayment || blockingPayment) {
        await setSwitchState(dependencies.db, dependencies.sessionId, 'PAYMENT_DETECTED', now, {
            'paymentMethodSwitch.reason': mismatchedPayment
                ? 'PAYMENT_CORRELATION_MISMATCH'
                : 'PAYMENT_ALREADY_IN_PROGRESS',
        });
        return {
            kind: 'payment_detected',
            code: 'pix_payment_detected',
            message: 'Um pagamento PIX foi identificado. Aguarde a confirmaÃ§Ã£o antes de tentar outra forma.',
        };
    }

    const cancellation = await requestCheckoutCancellation(
        dependencies.apiUrl,
        dependencies.apiKey,
        checkoutId,
        fetcher,
    );
    if (cancellation.status === null) {
        await setSwitchState(dependencies.db, dependencies.sessionId, 'RETRYABLE', now, {
            'paymentMethodSwitch.reason': 'CHECKOUT_CANCELLATION_TIMEOUT',
            'paymentMethodSwitch.lastGatewayStatus': null,
        });
        return {
            kind: 'pending',
            code: 'pix_switch_pending',
            message: 'Estamos confirmando o cancelamento do PIX. NÃ£o tente pagar com cartÃ£o ainda.',
        };
    }

    if (!cancellation.confirmed) {
        if (cancellation.retryable) {
            await setSwitchState(dependencies.db, dependencies.sessionId, 'RETRYABLE', now, {
                'paymentMethodSwitch.reason': 'CHECKOUT_CANCELLATION_RETRYABLE',
                'paymentMethodSwitch.lastGatewayStatus': cancellation.status,
            });
        } else {
            const afterFailure = await lookupCheckoutPayments(
                dependencies.apiUrl,
                dependencies.apiKey,
                checkoutId,
                fetcher,
            );
            const paymentDetected = afterFailure.payments.some(
                paymentPreventsCheckoutCancellation,
            );
            await setSwitchState(
                dependencies.db,
                dependencies.sessionId,
                paymentDetected ? 'PAYMENT_DETECTED' : 'REVIEW_REQUIRED',
                now,
                {
                    'paymentMethodSwitch.reason': paymentDetected
                        ? 'PAYMENT_DETECTED_AFTER_CANCELLATION_FAILURE'
                        : 'CHECKOUT_CANCELLATION_UNCONFIRMED',
                    'paymentMethodSwitch.lastGatewayStatus': cancellation.status,
                },
            );
            if (paymentDetected) {
                return {
                    kind: 'payment_detected',
                    code: 'pix_payment_detected',
                    message: 'Um pagamento PIX foi identificado. Aguarde a confirmaÃ§Ã£o.',
                };
            }
        }
        return {
            kind: 'pending',
            code: 'pix_switch_pending',
            message: 'O cancelamento do PIX ainda precisa ser verificado. Sua vaga continua reservada.',
        };
    }

    try {
        const replacement = await runPaymentTransaction(
            dependencies.client,
            (mongoSession) => completePixToCardSwitch(
                dependencies.db,
                dependencies.sessionId,
                mongoSession,
                'CHECKOUT_CANCELED_FOR_CARD_SWITCH',
                now,
            ),
        );
        return { kind: 'completed', session: replacement };
    } catch (error) {
        await setSwitchState(dependencies.db, dependencies.sessionId, 'REVIEW_REQUIRED', now, {
            'paymentMethodSwitch.reason': 'LOCAL_SWITCH_TRANSACTION_FAILED',
        });
        console.error('Falha ao concluir troca segura de PIX para cartÃ£o:', error);
        return {
            kind: 'pending',
            code: 'pix_switch_pending',
            message: 'O PIX foi cancelado e a nova sessÃ£o estÃ¡ sendo conciliada.',
        };
    }
}
