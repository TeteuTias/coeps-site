// Situação da cobrança de uma atividade paga para um participante.
// A vaga é reservada quando o PIX é gerado e fica guardada por 15 minutos;
// a inscrição só vale depois do pagamento.

export const ACTIVITY_SEAT_HOLD_MINUTES = 15;

const PAID = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
const OVERDUE = new Set(['PAYMENT_OVERDUE', 'OVERDUE']);
// PAYMENT_UPDATED só acontece em cobrança ainda não paga (mudança de valor ou vencimento).
const PENDING = new Set(['PENDING', 'PAYMENT_CREATED', 'PAYMENT_UPDATED']);

export function isActivityChargePaid(charge) {
    return PAID.has(String(charge?.status || ''));
}

export function isActivityChargeOpen(charge) {
    const status = String(charge?.status || '');
    return PENDING.has(status) || OVERDUE.has(status);
}

/**
 * Até quando a vaga fica reservada por esta cobrança.
 * Cobrança nova: 15 minutos depois de gerada (ou renovada). Cobrança antiga, sem o horário
 * da reserva: fim do dia do vencimento. Sem nenhuma das duas informações: null (não mexe).
 * @returns {Date | null}
 */
export function activityChargeHoldUntil(charge) {
    const reservedAt = charge?._reservedAt instanceof Date
        ? charge._reservedAt
        : (typeof charge?._reservedAt === 'string' ? new Date(charge._reservedAt) : null);
    if (reservedAt && Number.isFinite(reservedAt.getTime())) {
        return new Date(reservedAt.getTime() + ACTIVITY_SEAT_HOLD_MINUTES * 60 * 1000);
    }
    const dueDate = typeof charge?.dueDate === 'string' ? charge.dueDate.slice(0, 10) : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        const end = new Date(`${dueDate}T23:59:59.999-03:00`);
        return Number.isFinite(end.getTime()) ? end : null;
    }
    return null;
}

/** Cobrança em aberto cuja reserva já passou do prazo. */
export function isActivityChargeExpired(charge, now = new Date()) {
    if (!isActivityChargeOpen(charge)) return false;
    if (OVERDUE.has(String(charge?.status || '')) && !charge?._reservedAt) return true;
    const holdUntil = activityChargeHoldUntil(charge);
    return Boolean(holdUntil && holdUntil.getTime() < now.getTime());
}

/**
 * @param {unknown} payments  usuarios.pagamento.lista_pagamentos
 * @param {string} eventId    _id da atividade
 * @param {Date} [now]
 * @returns {{ state: 'paga' | 'pendente' | 'vencida', id: string | null, link: string | null, value: unknown, dueDate: unknown, holdUntil: string | null } | null}
 *          null quando não há cobrança conhecida para a atividade (segue a regra antiga: inscrito).
 */
export function activityChargeState(payments, eventId, now = new Date()) {
    const charges = (Array.isArray(payments) ? payments : []).filter(
        (payment) => payment?._type === 'activity' && String(payment?._eventID) === String(eventId),
    );
    let pending = null;
    let expired = null;
    for (const charge of charges) {
        if (isActivityChargePaid(charge)) return describe('paga', charge);
        if (!isActivityChargeOpen(charge)) continue;
        // fica a mais recente de cada tipo (a lista é em ordem de criação)
        if (isActivityChargeExpired(charge, now)) expired = charge;
        else pending = charge;
    }
    if (pending) return describe('pendente', pending);
    if (expired) return describe('vencida', expired);
    return null;
}

function describe(state, charge) {
    const holdUntil = state === 'paga' ? null : activityChargeHoldUntil(charge);
    return {
        state,
        id: typeof charge?.id === 'string' ? charge.id : null,
        link: typeof charge?.invoiceUrl === 'string' ? charge.invoiceUrl : null,
        value: charge?.value,
        dueDate: charge?.dueDate,
        holdUntil: holdUntil ? holdUntil.toISOString() : null,
    };
}
