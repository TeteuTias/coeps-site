// Regras do script cancel-orphan-activity-charges.mjs, separadas para teste (sem banco nem rede).

export const OPEN_STATUSES = new Set(['PENDING', 'OVERDUE']);
export const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

/**
 * Cobranças de atividade que merecem olhar: pessoa fora da atividade, atividade inexistente
 * ou mais de uma cobrança da mesma atividade para quem está inscrito.
 * users: [{ _id, pagamento: { lista_pagamentos } }]; activities: [{ _id, name, participants }].
 */
export function findCandidates(users, activities) {
    const byId = new Map(activities.map((a) => [String(a._id), {
        name: a.name,
        participants: new Set((a.participants ?? []).map(String)),
    }]));
    const candidates = [];
    for (const user of users) {
        const userId = String(user._id);
        const charges = (user.pagamento?.lista_pagamentos ?? [])
            .filter((p) => p?._type === 'activity' && typeof p.id === 'string');
        const perEvent = new Map();
        for (const charge of charges) {
            const eventId = String(charge._eventID);
            perEvent.set(eventId, [...(perEvent.get(eventId) ?? []), charge]);
        }
        for (const [eventId, list] of perEvent) {
            const activity = byId.get(eventId);
            const inscrito = Boolean(activity?.participants.has(userId));
            if (activity && inscrito && list.length === 1) continue;
            for (const charge of list) {
                candidates.push({
                    userId,
                    chargeId: charge.id,
                    eventId,
                    atividade: activity?.name ?? null,
                    valor: charge.value ?? null,
                    atividadeExiste: Boolean(activity),
                    inscrito,
                });
            }
        }
    }
    return candidates;
}

/**
 * gateway: { status, deleted } da consulta no Asaas; { notFound: true } para 404; { error } se falhou.
 * Só "cancelar" leva a uma exclusão no Asaas com --apply. O resto é para revisão manual.
 */
export function classify(candidate, gateway) {
    if (gateway?.error) return 'erro-consulta';
    if (gateway?.notFound || gateway?.deleted) return 'ja-excluida-no-asaas';
    const status = String(gateway?.status || '');
    if (!candidate.atividadeExiste) return 'revisar-atividade-inexistente';
    if (candidate.inscrito) return OPEN_STATUSES.has(status) ? 'revisar-cobranca-duplicada' : 'ok';
    if (OPEN_STATUSES.has(status)) return 'cancelar';
    if (PAID_STATUSES.has(status)) return 'revisar-paga-sem-inscricao';
    return 'ok';
}
