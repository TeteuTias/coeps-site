import type { ClientSession, Db, Document, WithId } from 'mongodb';

export interface LegacyPaymentContext {
    user: WithId<Document>;
    storedPayment: Document;
    match: Document;
    matchKey: 'invoiceNumber' | 'id';
    matchValues: unknown[];
}

export async function findLegacyPaymentContext(
    db: Db,
    payment: Record<string, unknown>,
    mongoSession?: ClientSession,
): Promise<LegacyPaymentContext | null> {
    if (!payment.customer || (!payment.invoiceNumber && !payment.id)) return null;

    const matchKey = payment.invoiceNumber ? 'invoiceNumber' : 'id';
    const rawMatchValue = payment.invoiceNumber || payment.id;
    const matchValues = [...new Set([rawMatchValue, String(rawMatchValue)])];
    const match = { [matchKey]: { $in: matchValues } };
    const user = await db.collection('usuarios').findOne(
        {
            id_api: payment.customer,
            pagamento: { $exists: true },
            'pagamento.lista_pagamentos': { $elemMatch: match },
        },
        {
            projection: {
                _id: 1,
                'pagamento.situacao': 1,
                'pagamento.edicaoId': 1,
                'pagamento.compraId': 1,
                'pagamento.lista_pagamentos': 1,
            },
            session: mongoSession,
        },
    );
    if (!user) return null;

    const storedPayment = user.pagamento?.lista_pagamentos?.find(
        (stored: Document) => String(stored?.[matchKey] ?? '') === String(rawMatchValue),
    );
    if (!storedPayment) return null;

    return { user, storedPayment, match, matchKey, matchValues };
}
