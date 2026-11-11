// Situação da cobrança de uma atividade paga para um participante.
// A vaga é reservada quando o PIX é gerado; a inscrição só vale depois do pagamento.

const PAID = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
const OVERDUE = new Set(['PAYMENT_OVERDUE', 'OVERDUE']);
// PAYMENT_UPDATED só acontece em cobrança ainda não paga (mudança de valor ou vencimento).
const PENDING = new Set(['PENDING', 'PAYMENT_CREATED', 'PAYMENT_UPDATED']);

function isPastDue(dueDate, today) {
    return typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dueDate) && dueDate.slice(0, 10) < today;
}

/**
 * @param {unknown} payments  usuarios.pagamento.lista_pagamentos
 * @param {string} eventId    _id da atividade
 * @param {string} today      data de hoje em America/Sao_Paulo, formato yyyy-MM-dd
 * @returns {{ state: 'paga' | 'pendente' | 'vencida', id: string | null, link: string | null, value: unknown } | null}
 *          null quando não há cobrança conhecida para a atividade (segue a regra antiga: inscrito).
 */
export function activityChargeState(payments, eventId, today) {
    const charges = (Array.isArray(payments) ? payments : []).filter(
        (payment) => payment?._type === 'activity' && String(payment?._eventID) === String(eventId),
    );
    let pending = null;
    let overdue = null;
    for (const charge of charges) {
        const status = String(charge?.status || '');
        if (PAID.has(status)) {
            return describe('paga', charge);
        }
        if (OVERDUE.has(status) || (PENDING.has(status) && isPastDue(charge?.dueDate, today))) {
            overdue = charge; // fica a mais recente (a lista é em ordem de criação)
        } else if (PENDING.has(status)) {
            pending = charge;
        }
    }
    if (pending) return describe('pendente', pending);
    if (overdue) return describe('vencida', overdue);
    return null;
}

function describe(state, charge) {
    return {
        state,
        id: typeof charge?.id === 'string' ? charge.id : null,
        link: typeof charge?.invoiceUrl === 'string' ? charge.invoiceUrl : null,
        value: charge?.value,
    };
}
