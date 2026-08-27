import { ObjectId, type Db } from 'mongodb';
import type { ActivePaymentConfig } from '@/lib/payments/config';
import { getEditionId } from '@/lib/payments/config';
import {
    createPaymentAssignment,
    getTrackingCodeForPurchase,
    releaseDiscountReservation,
    reserveDiscountCode,
} from '@/lib/payments/codes';
import { applyDiscountToLot } from '@/lib/payments/prices';

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
    const originalLot = {
        codigo: 0,
        nome: input.config.nome,
        limiteVagas: Number.MAX_SAFE_INTEGER,
        precos: {
            valorAVista: input.config.valorAVista,
            valorPix: input.config.valorPix,
            valorBoleto: input.config.valorBoleto,
            valorDebito: input.config.valorDebito,
            parcelamentos: input.config.parcelamentos ?? [],
        },
    };
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

        const discounted = applyDiscountToLot(
            originalLot,
            discountSnapshot?.percentualDesconto ?? 0,
        );
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
            paymentConfigOriginal: originalLot,
            paymentConfig: discounted.lot,
            valoresCentavos: discounted.amounts,
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
            valoresCentavos: discounted.amounts,
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
