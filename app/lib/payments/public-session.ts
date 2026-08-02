import type { Document } from 'mongodb';

function publicCodeSnapshot(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;

    const snapshot = value as Record<string, unknown>;
    if (typeof snapshot.codigo !== 'string') return undefined;

    return {
        codigo: snapshot.codigo,
        tipo: snapshot.tipo,
        ...(typeof snapshot.percentualDesconto === 'number'
            ? { percentualDesconto: snapshot.percentualDesconto }
            : {}),
    };
}

export function toPublicPaymentSession(session: Document | null) {
    if (!session) return false;

    const {
        owner: _owner,
        codigoDesconto,
        codigoRastreio,
        ...publicSession
    } = session;

    return {
        ...publicSession,
        ...(codigoDesconto
            ? { codigoDesconto: publicCodeSnapshot(codigoDesconto) }
            : {}),
        ...(codigoRastreio
            ? { codigoRastreio: publicCodeSnapshot(codigoRastreio) }
            : {}),
    };
}
