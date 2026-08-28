import {
    ObjectId,
    type ClientSession,
    type Db,
    type WithId,
    type Document,
} from 'mongodb';
import type { ILoteAutomatico, IPaymentConfig } from '@/lib/types/payments/payment.t';

const LEGACY_PAYMENT_CONFIG_ID = '66bcfceedc9c7250e85b2ac6';

function normalizeEditionId(value: string | undefined): string | undefined {
    const normalized = value?.trim().toUpperCase();
    return normalized || undefined;
}

export type ActivePaymentConfig = WithId<Document> & IPaymentConfig;

export function getEditionId(config: { _id: unknown; edicaoId?: string }): string {
    const explicitEdition = normalizeEditionId(config.edicaoId);

    if (explicitEdition) {
        return explicitEdition;
    }

    const environmentEdition = normalizeEditionId(
        process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID,
    );
    if (environmentEdition) {
        return environmentEdition;
    }

    return String(config._id);
}

export async function getActivePaymentConfig(db: Db): Promise<ActivePaymentConfig | null> {
    const configuredEdition = normalizeEditionId(
        process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID,
    );

    if (configuredEdition) {
        const byEdition = await db.collection('ingressos_config').findOne({
            edicaoId: configuredEdition,
            ativo: true,
        });
        return byEdition as ActivePaymentConfig | null;
    }

    const explicitlyActive = await db.collection('ingressos_config').findOne(
        { ativo: true },
        { sort: { updatedAt: -1, dataInit: -1 } },
    );

    if (explicitlyActive) {
        return explicitlyActive as ActivePaymentConfig;
    }

    const legacy = await db.collection('ingressos_config').findOne({
        _id: new ObjectId(LEGACY_PAYMENT_CONFIG_ID),
        $or: [{ ativo: true }, { ativo: { $exists: false } }],
    });

    return legacy as ActivePaymentConfig | null;
}

export async function isPaymentMethodAllowedForSession(
    db: Db,
    session: { edicaoId?: string; metodosPagamentoPermitidos?: unknown },
    method: 'PIX' | 'BOLETO' | 'DEBIT_CARD' | 'CREDIT_CARD',
): Promise<boolean> {
    if (Array.isArray(session.metodosPagamentoPermitidos)) {
        return session.metodosPagamentoPermitidos.includes(method);
    }

    const config = await getActivePaymentConfig(db);
    return Boolean(
        config &&
        getEditionId(config) === session.edicaoId &&
        config.pagamentosAceitos?.includes(method),
    );
}

export function isPaymentSalesOpen(
    config: Pick<IPaymentConfig, 'dataInit' | 'dataEnd'>,
    now = new Date(),
): boolean {
    const startsAt = paymentBoundaryTimestamp(config.dataInit, false);
    const endsAt = paymentBoundaryTimestamp(config.dataEnd, true);
    const timestamp = now.getTime();

    return (
        (!Number.isFinite(startsAt) || timestamp >= startsAt) &&
        (!Number.isFinite(endsAt) || timestamp <= endsAt)
    );
}

function paymentBoundaryTimestamp(value: string, endOfDay: boolean): number {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
        return Date.parse(`${value}T${time}-03:00`);
    }

    return new Date(value).getTime();
}

export async function countReservedTicketPlaces(
    db: Db,
    edicaoId: string,
    now = new Date(),
    mongoSession?: ClientSession,
): Promise<number> {
    return db.collection('pagamentos.sessoes').aggregate([
        // Filtro original do countDocuments para buscar as sessões válidas/ativas
        {
            $match: {
                type: 'ticket',
                edicaoId,
                $or: [
                    {
                        status: 'OPEN',
                        expiresAt: { $gt: now },
                    },
                    {
                        status: {
                            $in: [
                                'CREATING_PAYMENT',
                                'PAYMENT_PENDING',
                                'PAYMENT_REVIEW_REQUIRED',
                            ],
                        },
                    },
                ],
            },
        },
        // Faz o Join com a coleção de códigos
        {
            $lookup: {
                from: 'pagamentos.codigos',
                localField: 'codigoDesconto.codigoNormalizado',
                foreignField: 'codigoNormalizado',
                as: 'dadosDoCodigo',
            },
        },
        // Remove da contagem caso o perfil atrelado ao código seja CONGRESSISTA.
        // Sessões sem código (null) passarão normalmente por aqui.
        {
            $match: {
                'dadosDoCodigo.perfilUtilizador': { $ne: 'CONGRESSISTA' },
            },
        },
        // Conta quantas sessões restaram
        {
            $count: 'totalSessoes',
        },
    ], { session: mongoSession })
        .toArray()
        .then(result => result[0]?.totalSessoes || 0);
}

export async function getCurrentAutomaticLot(
    db: Db,
    config: ActivePaymentConfig,
    now = new Date(),
    mongoSession?: ClientSession,
): Promise<ILoteAutomatico | null> {
    const edicaoId = getEditionId(config);
    const legacyPaidUsers = await db.collection('usuarios').countDocuments(
        {
            'pagamento.situacao': 1,
            'pagamento.edicaoId': edicaoId,
            'pagamento.compraId': { $exists: false },
            'pagamento.tipo_pagamento': { $not: /^organizador$/i },
        },
        { session: mongoSession },
    );
    const [confirmedAssignments, reservedPlaces] = await Promise.all([
        db.collection('pagamentos.atribuicoes').aggregate([
            // Filtro inicial
            {
                $match: {
                    edicaoId,
                    status: 'CONFIRMADA',
                },
            },
            // Busca o código na coleção de códigos
            {
                $lookup: {
                    from: 'pagamentos.codigos',
                    localField: 'codigoDesconto.codigoNormalizado',
                    foreignField: 'codigoNormalizado',
                    as: 'dadosDoCodigo',
                },
            },
            // Mantém apenas onde o perfil NÃO é CONGRESSISTA.
            // Se o código for NULL, o 'dadosDoCodigo' será vazio e passará por essa regra.
            {
                $match: {
                    'dadosDoCodigo.perfilUtilizador': { $ne: 'CONGRESSISTA' },
                },
            },
            // 4. Conta os documentos restantes
            {
                $count: 'totalVagas',
            },
        ], { session: mongoSession })
            .toArray()
            .then(result => result[0]?.totalVagas || 0),
        countReservedTicketPlaces(db, edicaoId, now, mongoSession),
    ]);
    const occupied = legacyPaidUsers + confirmedAssignments + reservedPlaces;
    const lots = config.configuracaoLotesAutomaticos?.lotes ?? [];
    let accumulatedCapacity = 0;

    for (let index = 0; index < lots.length; index += 1) {
        const lot = lots[index];
        accumulatedCapacity += lot.limiteVagas;

        if (occupied < accumulatedCapacity) {
            return lot;
        }
    }

    return null;
}

export async function lockPaymentCapacityCalculation(
    db: Db,
    config: ActivePaymentConfig,
    mongoSession: ClientSession,
): Promise<void> {
    const result = await db.collection('ingressos_config').updateOne(
        { _id: config._id },
        {
            $inc: { paymentCapacityVersion: 1 },
            $set: { lastCapacityCheckAt: new Date() },
        },
        { session: mongoSession },
    );

    if (result.modifiedCount !== 1) {
        throw new Error('A configuração de capacidade não pôde ser bloqueada.');
    }
}
