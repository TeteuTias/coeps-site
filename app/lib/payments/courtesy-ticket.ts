import type { ClientSession, Db, Document } from 'mongodb';
import { createPaymentAssignment, PaymentCodeError } from './codes.ts';

export const COURTESY_PAYMENT_METHOD = 'CORTESIA';

/**
 * Confirma na hora a inscrição de um profissional da saúde (código gratuito): não existe cobrança no Asaas.
 * Deve rodar na mesma transação que contou o uso do código (`claimHealthCodeUse`) e inseriu a sessão CONFIRMED.
 */
export async function confirmCourtesyTicket(
    db: Db,
    session: Document,
    mongoSession: ClientSession,
    now = new Date(),
): Promise<void> {
    const userUpdate = await db.collection('usuarios').updateOne(
        { _id: session.owner, 'pagamento.situacao': { $ne: 1 } },
        {
            $set: {
                'pagamento.situacao': 1,
                'pagamento.tipo_pagamento': 'profissional_saude',
                'pagamento.edicaoId': session.edicaoId,
                'pagamento.compraId': session._id,
            },
        },
        { session: mongoSession },
    );
    if (userUpdate.matchedCount !== 1) {
        throw new PaymentCodeError(
            'Sua inscrição nesta edição já está confirmada.',
            409,
            'REGISTRATION_ALREADY_CONFIRMED',
        );
    }

    await createPaymentAssignment(db, {
        compraId: session._id,
        edicaoId: session.edicaoId,
        usuarioId: session.owner,
        codigoDesconto: session.codigoDesconto,
        codigoRastreio: session.codigoRastreio,
        valoresCentavos: session.valoresCentavos,
        valorSelecionadoCentavos: {
            original: session.valoresCentavos.original.PIX,
            desconto: session.valoresCentavos.original.PIX,
            final: 0,
        },
        perfilUtilizador: session.perfilUtilizador,
        origemPreco: 'CORTESIA',
        status: 'CONFIRMADA',
        pagamento: { metodo: COURTESY_PAYMENT_METHOD },
        createdAt: now,
        confirmedAt: now,
        updatedAt: now,
    }, mongoSession);

    await db.collection('pagamentos.comprovantes').updateOne(
        { compraId: session._id },
        {
            $setOnInsert: {
                compraId: session._id,
                owner: session.owner,
                type: 'ticket',
                title: 'EM BREVE!',
                createdAt: now,
            },
            $set: { status: 'PAID', updatedAt: now },
        },
        { upsert: true, session: mongoSession },
    );

}
