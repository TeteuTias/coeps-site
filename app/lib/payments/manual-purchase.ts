import { ObjectId, type Db } from 'mongodb';
import type { ActivePaymentConfig } from '@/lib/payments/config';
import { getEditionId } from '@/lib/payments/config';
import {
    createPaymentAssignment,
    getTrackingCodeForPurchase,
    releaseDiscountReservation,
    reserveDiscountCode,
} from '@/lib/payments/codes';
import { buildManualPaymentLot, resolvePaymentOffer } from '@/lib/payments/offer';

export async function prepareManualTicketPurchase(
    db: Db,
    input: {
        owner: ObjectId;
        config: ActivePaymentConfig;
        codigoDesconto?: unknown;
        codigoRastreio?: unknown;
        userProps?: Record<string, unknown>;
    },
) {
    const now = new Date();
    const compraId = new ObjectId();
    const edicaoId = getEditionId(input.config);
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const originalLot = buildManualPaymentLot(input.config);
    let discountSnapshot;
    let trackingSnapshot;

    if (input.codigoDesconto) {
        discountSnapshot = await reserveDiscountCode(db, {
            edicaoId,
            codigo: input.codigoDesconto,
            compraId,
            usuarioId: input.owner,
            reservadoAte: expiresAt,
        });
    }

    try {
        if (input.codigoRastreio) {
            trackingSnapshot = await getTrackingCodeForPurchase(
                db,
                edicaoId,
                input.codigoRastreio,
            );
        }

        const offer = resolvePaymentOffer({
            config: input.config,
            currentLot: originalLot,
            discount: discountSnapshot,
        });
        const session = {
            _id: compraId,
            activeKey: `${edicaoId}:${input.owner.toHexString()}:ticket`,
            owner: input.owner,
            edicaoId,
            type: 'ticket',
            source: 'manual',
            status: 'CREATING_PAYMENT',
            expiresAt,
            createdAt: now,
            updatedAt: now,
            paymentConfigOriginal: offer.originalLot,
            paymentConfig: offer.finalLot,
            valoresCentavos: offer.amounts,
            perfilUtilizador: offer.perfilUtilizador,
            origemPreco: offer.origemPreco,
            codigoDesconto: discountSnapshot,
            codigoRastreio: trackingSnapshot,
            orderId: null,
            paymentUrl: null,
            metodoPagamento: null,
            userProps: input.userProps,
        };

        await db.collection('pagamentos.sessoes').insertOne(session);
        await createPaymentAssignment(db, {
            compraId,
            edicaoId,
            usuarioId: input.owner,
            codigoDesconto: discountSnapshot,
            codigoRastreio: trackingSnapshot,
            valoresCentavos: offer.amounts,
            perfilUtilizador: offer.perfilUtilizador,
            origemPreco: offer.origemPreco,
            status: 'ABERTA',
            createdAt: now,
            updatedAt: now,
        });

        return session;
    } catch (error) {
        await db.collection('pagamentos.sessoes').deleteOne({ _id: compraId });
        if (discountSnapshot) {
            await releaseDiscountReservation(db, compraId);
        }
        throw error;
    }
}
