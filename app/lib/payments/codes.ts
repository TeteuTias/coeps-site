import type { ClientSession, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import type {
    PaymentAssignmentDocument,
    PaymentAssignmentStatus,
    PaymentCodeDocument,
    PaymentCodeSnapshot,
} from '@/lib/types/payments/paymentCode.t';

export const PAYMENT_CODES_COLLECTION = 'pagamentos.codigos';
export const PAYMENT_ASSIGNMENTS_COLLECTION = 'pagamentos.atribuicoes';
export const PAYMENT_CODE_ATTEMPTS_COLLECTION = 'pagamentos.codigo_tentativas';

interface PaymentCodeAttemptDocument {
    _id: string;
    count: number;
    userId: ObjectId;
    windowStartedAt: Date;
    expiresAt: Date;
}

export class PaymentCodeError extends Error {
    public readonly status: number;
    public readonly code: string;

    constructor(
        message: string,
        status = 400,
        code = 'INVALID_PAYMENT_CODE',
    ) {
        super(message);
        this.name = 'PaymentCodeError';
        this.status = status;
        this.code = code;
    }
}

export function paymentCodesEnabled(): boolean {
    return process.env.PAYMENT_CODES_ENABLED?.trim().toLowerCase() === 'true';
}

export function normalizePaymentCode(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

export async function enforcePaymentCodePreviewRateLimit(
    db: Db,
    userId: ObjectId,
    now = new Date(),
): Promise<void> {
    const minuteWindow = Math.floor(now.getTime() / 60_000);
    const key = `${userId.toHexString()}:${minuteWindow}`;
    const attempt = await db
        .collection<PaymentCodeAttemptDocument>(PAYMENT_CODE_ATTEMPTS_COLLECTION)
        .findOneAndUpdate(
        { _id: key },
        {
            $inc: { count: 1 },
            $setOnInsert: {
                userId,
                windowStartedAt: new Date(minuteWindow * 60_000),
                expiresAt: new Date(now.getTime() + 10 * 60_000),
            },
        },
        { upsert: true, returnDocument: 'after' },
    );

    if (Number(attempt?.count ?? 0) > 10) {
        throw new PaymentCodeError(
            'Muitas tentativas. Aguarde um minuto e tente novamente.',
            429,
            'PAYMENT_CODE_RATE_LIMITED',
        );
    }
}

function requireNormalizedCode(value: unknown): string {
    const normalized = normalizePaymentCode(value);

    if (normalized.length < 4 || normalized.length > 64) {
        throw new PaymentCodeError(
            'Código inválido ou indisponível.',
            422,
            'PAYMENT_CODE_UNAVAILABLE',
        );
    }

    return normalized;
}

function toSnapshot(code: PaymentCodeDocument): PaymentCodeSnapshot {
    return {
        codigoId: code._id,
        codigo: code.codigo,
        codigoNormalizado: code.codigoNormalizado,
        tipo: code.tipo,
        percentualDesconto: code.percentualDesconto,
        responsavel: code.responsavel,
    };
}

async function findAvailableCode(
    db: Db,
    edicaoId: string,
    rawCode: unknown,
    tipo: 'DESCONTO' | 'RASTREIO',
    mongoSession?: ClientSession,
): Promise<PaymentCodeDocument> {
    const codigoNormalizado = requireNormalizedCode(rawCode);
    const now = new Date();
    const code = await db.collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION).findOne(
        {
            edicaoId,
            codigoNormalizado,
            tipo,
            status: 'ATIVO',
            $and: [
                { $or: [{ validoDe: { $exists: false } }, { validoDe: null }, { validoDe: { $lte: now } }] },
                { $or: [{ validoAte: { $exists: false } }, { validoAte: null }, { validoAte: { $gt: now } }] },
            ],
        },
        { session: mongoSession },
    );

    if (!code) {
        throw new PaymentCodeError(
            'Código inválido ou indisponível.',
            422,
            'PAYMENT_CODE_UNAVAILABLE',
        );
    }

    if (
        tipo === 'DESCONTO' &&
        (!Number.isInteger(code.percentualDesconto) ||
            Number(code.percentualDesconto) < 1 ||
            Number(code.percentualDesconto) > 99)
    ) {
        throw new PaymentCodeError(
            'Código inválido ou indisponível.',
            422,
            'PAYMENT_CODE_UNAVAILABLE',
        );
    }

    return code;
}

export async function previewPaymentCodes(
    db: Db,
    input: {
        edicaoId: string;
        codigoDesconto?: unknown;
        codigoRastreio?: unknown;
    },
): Promise<{
    desconto?: PaymentCodeSnapshot;
    rastreio?: PaymentCodeSnapshot;
}> {
    if (!input.codigoDesconto && !input.codigoRastreio) {
        return {};
    }

    if (!paymentCodesEnabled()) {
        throw new PaymentCodeError(
            'O uso de códigos está temporariamente indisponível.',
            503,
            'PAYMENT_CODES_DISABLED',
        );
    }

    const [discountCode, trackingCode] = await Promise.all([
        input.codigoDesconto
            ? findAvailableCode(db, input.edicaoId, input.codigoDesconto, 'DESCONTO')
            : null,
        input.codigoRastreio
            ? findAvailableCode(db, input.edicaoId, input.codigoRastreio, 'RASTREIO')
            : null,
    ]);

    return {
        desconto: discountCode ? toSnapshot(discountCode) : undefined,
        rastreio: trackingCode ? toSnapshot(trackingCode) : undefined,
    };
}

export async function reserveDiscountCode(
    db: Db,
    input: {
        edicaoId: string;
        codigo: unknown;
        compraId: ObjectId;
        usuarioId: ObjectId;
        reservadoAte: Date;
        mongoSession?: ClientSession;
    },
): Promise<PaymentCodeSnapshot> {
    if (!paymentCodesEnabled()) {
        throw new PaymentCodeError(
            'O uso de códigos está temporariamente indisponível.',
            503,
            'PAYMENT_CODES_DISABLED',
        );
    }

    const codigoNormalizado = requireNormalizedCode(input.codigo);
    const now = new Date();
    const result = await db
        .collection<PaymentCodeDocument>(PAYMENT_CODES_COLLECTION)
        .findOneAndUpdate(
            {
                edicaoId: input.edicaoId,
                codigoNormalizado,
                tipo: 'DESCONTO',
                $and: [
                    { $or: [{ validoDe: { $exists: false } }, { validoDe: null }, { validoDe: { $lte: now } }] },
                    { $or: [{ validoAte: { $exists: false } }, { validoAte: null }, { validoAte: { $gt: now } }] },
                ],
                $or: [
                    { status: 'ATIVO' },
                    {
                        status: 'RESERVADO',
                        'reserva.cobrancaExternaCriada': { $ne: true },
                        'reserva.reservadoAte': { $lte: now },
                    },
                ],
            },
            {
                $set: {
                    status: 'RESERVADO',
                    reserva: {
                        compraId: input.compraId,
                        usuarioId: input.usuarioId,
                        reservadoEm: now,
                        reservadoAte: input.reservadoAte,
                        cobrancaExternaCriada: false,
                    },
                    updatedAt: now,
                },
            },
            { returnDocument: 'after', session: input.mongoSession },
        );

    if (!result) {
        throw new PaymentCodeError(
            'Código inválido ou indisponível.',
            409,
            'PAYMENT_CODE_ALREADY_USED',
        );
    }

    return toSnapshot(result);
}

export async function getTrackingCodeForPurchase(
    db: Db,
    edicaoId: string,
    rawCode: unknown,
    mongoSession?: ClientSession,
): Promise<PaymentCodeSnapshot> {
    if (!paymentCodesEnabled()) {
        throw new PaymentCodeError(
            'O uso de códigos está temporariamente indisponível.',
            503,
            'PAYMENT_CODES_DISABLED',
        );
    }

    return toSnapshot(
        await findAvailableCode(db, edicaoId, rawCode, 'RASTREIO', mongoSession),
    );
}

export async function markDiscountHasExternalCharge(
    db: Db,
    compraId: ObjectId,
    mongoSession?: ClientSession,
): Promise<boolean> {
    const result = await db.collection(PAYMENT_CODES_COLLECTION).updateOne(
        {
            tipo: 'DESCONTO',
            status: 'RESERVADO',
            'reserva.compraId': compraId,
        },
        {
            $set: {
                'reserva.cobrancaExternaCriada': true,
                'reserva.reservadoAte': null,
                updatedAt: new Date(),
            },
        },
        { session: mongoSession },
    );

    return result.modifiedCount === 1;
}

export async function restoreDiscountAfterRejectedCharge(
    db: Db,
    compraId: ObjectId,
    reservadoAte: Date,
    mongoSession?: ClientSession,
): Promise<void> {
    await db.collection(PAYMENT_CODES_COLLECTION).updateOne(
        {
            tipo: 'DESCONTO',
            status: 'RESERVADO',
            'reserva.compraId': compraId,
        },
        {
            $set: {
                'reserva.cobrancaExternaCriada': false,
                'reserva.reservadoAte': reservadoAte,
                updatedAt: new Date(),
            },
        },
        { session: mongoSession },
    );
}

export async function releaseDiscountReservation(
    db: Db,
    compraId: ObjectId,
    mongoSession?: ClientSession,
): Promise<boolean> {
    const result = await db.collection(PAYMENT_CODES_COLLECTION).updateOne(
        {
            tipo: 'DESCONTO',
            status: 'RESERVADO',
            'reserva.compraId': compraId,
        },
        {
            $set: {
                status: 'ATIVO',
                updatedAt: new Date(),
            },
            $unset: { reserva: '' },
        },
        { session: mongoSession },
    );
    return result.matchedCount === 1;
}

export async function consumeDiscountCode(
    db: Db,
    compraId: ObjectId,
    mongoSession?: ClientSession,
    codigoId?: ObjectId | string,
): Promise<boolean> {
    const now = new Date();
    const consumed = await db.collection(PAYMENT_CODES_COLLECTION).findOneAndUpdate(
        {
            tipo: 'DESCONTO',
            status: 'RESERVADO',
            'reserva.compraId': compraId,
        },
        {
            $set: {
                status: 'USADO',
                usedAt: now,
                usedPurchaseId: compraId,
                updatedAt: now,
            },
            $unset: { reserva: '' },
        },
        { returnDocument: 'after', session: mongoSession },
    );
    if (consumed) return true;

    const alreadyConsumed = await db.collection(PAYMENT_CODES_COLLECTION).findOne(
        {
            tipo: 'DESCONTO',
            status: 'USADO',
            usedPurchaseId: compraId,
        },
        { projection: { _id: 1 }, session: mongoSession },
    );
    if (alreadyConsumed) return true;

    if (codigoId && ObjectId.isValid(String(codigoId))) {
        const recovered = await db.collection(PAYMENT_CODES_COLLECTION).findOneAndUpdate(
            {
                _id: new ObjectId(String(codigoId)),
                tipo: 'DESCONTO',
                status: 'ATIVO',
            },
            {
                $set: {
                    status: 'USADO',
                    usedAt: now,
                    usedPurchaseId: compraId,
                    updatedAt: now,
                },
                $unset: { reserva: '' },
            },
            { returnDocument: 'after', session: mongoSession },
        );
        return Boolean(recovered);
    }

    return false;
}

export async function createPaymentAssignment(
    db: Db,
    assignment: PaymentAssignmentDocument,
    mongoSession?: ClientSession,
): Promise<void> {
    await db.collection(PAYMENT_ASSIGNMENTS_COLLECTION).updateOne(
        { compraId: assignment.compraId },
        { $setOnInsert: assignment },
        { upsert: true, session: mongoSession },
    );
}

export async function hasConfirmedRegistrationForEdition(
    db: Db,
    usuarioId: ObjectId,
    edicaoId: string,
    mongoSession?: ClientSession,
): Promise<boolean> {
    const [assignment, user] = await Promise.all([
        db.collection(PAYMENT_ASSIGNMENTS_COLLECTION).findOne(
            { usuarioId, edicaoId, status: 'CONFIRMADA' },
            { projection: { _id: 1 }, session: mongoSession },
        ),
        db.collection('usuarios').findOne(
            {
                _id: usuarioId,
                'pagamento.situacao': 1,
                'pagamento.edicaoId': edicaoId,
            },
            { projection: { _id: 1 }, session: mongoSession },
        ),
    ]);

    return Boolean(assignment || user);
}

export async function updateUserRegistrationAfterRefund(
    db: Db,
    usuarioId: ObjectId,
    edicaoId: string,
    refundedPurchaseId: ObjectId,
    mongoSession?: ClientSession,
): Promise<void> {
    const otherConfirmed = await db.collection(PAYMENT_ASSIGNMENTS_COLLECTION).findOne(
        {
            usuarioId,
            edicaoId,
            compraId: { $ne: refundedPurchaseId },
            status: 'CONFIRMADA',
        },
        { projection: { compraId: 1 }, session: mongoSession },
    );

    if (otherConfirmed) {
        await db.collection('usuarios').updateOne(
            { _id: usuarioId, 'pagamento.compraId': refundedPurchaseId },
            {
                $set: {
                    'pagamento.situacao': 1,
                    'pagamento.edicaoId': edicaoId,
                    'pagamento.compraId': otherConfirmed.compraId,
                },
            },
            { session: mongoSession },
        );
        return;
    }

    await db.collection('usuarios').updateOne(
        { _id: usuarioId, 'pagamento.compraId': refundedPurchaseId },
        {
            $set: {
                'pagamento.situacao': 0,
                'pagamento.refundedAt': new Date(),
            },
            $unset: { 'pagamento.compraId': '' },
        },
        { session: mongoSession },
    );
}

export async function updatePaymentAssignment(
    db: Db,
    compraId: ObjectId,
    status: PaymentAssignmentStatus,
    payment?: PaymentAssignmentDocument['pagamento'],
    mongoSession?: ClientSession,
): Promise<boolean> {
    const now = new Date();
    const set: Record<string, unknown> = {
        status,
        updatedAt: now,
    };

    if (payment) {
        for (const [key, value] of Object.entries(payment)) {
            if (value !== undefined) {
                set[`pagamento.${key}`] = value;
            }
        }
    }

    if (status === 'CONFIRMADA') {
        set.confirmedAt = now;
    }

    const result = await db
        .collection(PAYMENT_ASSIGNMENTS_COLLECTION)
        .updateOne({ compraId }, { $set: set }, { session: mongoSession });
    return result.matchedCount === 1;
}

export async function cancelPaymentAfterLostDiscountReservation(
    db: Db,
    compraId: ObjectId,
    mongoSession?: ClientSession,
): Promise<boolean> {
    const now = new Date();
    const transition = await db.collection('pagamentos.sessoes').updateOne(
        { _id: compraId, status: 'CREATING_PAYMENT' },
        {
            $set: {
                status: 'CANCELLED',
                gatewayState: 'DISCOUNT_RESERVATION_LOST',
                terminalAt: now,
                updatedAt: now,
            },
            $unset: { activeKey: '' },
        },
        { session: mongoSession },
    );

    if (transition.modifiedCount !== 1) return false;

    await updatePaymentAssignment(
        db,
        compraId,
        'CANCELADA',
        undefined,
        mongoSession,
    );
    return true;
}

export async function expireOpenSessionsForOwner(
    db: Db,
    owner: ObjectId,
    now = new Date(),
    edicaoId?: string,
): Promise<void> {
    const expiredSessions = await db
        .collection('pagamentos.sessoes')
        .find({
            owner,
            type: 'ticket',
            ...(edicaoId ? { edicaoId } : {}),
            status: 'OPEN',
            expiresAt: { $lte: now },
        })
        .project<{ _id: ObjectId }>({ _id: 1 })
        .toArray();

    for (const session of expiredSessions) {
        const result = await db.collection('pagamentos.sessoes').updateOne(
            { _id: session._id, status: 'OPEN' },
            {
                $set: { status: 'EXPIRED', updatedAt: now },
                $unset: { activeKey: '' },
            },
        );

        if (result.modifiedCount === 1) {
            await Promise.all([
                releaseDiscountReservation(db, session._id),
                updatePaymentAssignment(db, session._id, 'EXPIRADA'),
            ]);
        }
    }
}
