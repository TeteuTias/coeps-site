import type { Db } from 'mongodb';
import { asaasRequestHeaders } from './asaas.ts';
import { gatewayDeletionWasConfirmed } from './overdue.ts';
import {
    isActivityChargeExpired,
    isActivityChargeOpen,
    isActivityChargePaid,
} from '../activity-charge-state.js';

// Vaga de atividade paga fica reservada por 15 minutos a partir do PIX. Passado o prazo sem pagamento,
// a cobrança é excluída no Asaas e o webhook PAYMENT_DELETED (caminho que já existe) tira a pessoa da
// atividade, das etapas do pacote e de "Meus pagamentos". Cobrança excluída não pode ser paga depois.

type Charge = Record<string, unknown>;

export interface SeatActivity {
    _id: unknown;
    name?: unknown;
    isFree?: unknown;
    timeline?: unknown;
}

export type SeatIgnoreReason =
    | 'activity_missing'
    | 'free'
    | 'started'
    | 'not_open'
    | 'within_hold'
    | 'other_valid_charge';

export type SeatDecision = { action: 'check' } | { action: 'ignore'; reason: SeatIgnoreReason };

export type GatewayDecision = 'delete' | 'apply_deleted' | 'apply_received' | 'retry';

/** Primeiro horário da atividade; null quando não há data válida (aí não se mexe). */
export function activityStartsAt(activity: SeatActivity | null | undefined): Date | null {
    const timeline = Array.isArray(activity?.timeline) ? activity.timeline : [];
    let first: Date | null = null;
    for (const item of timeline) {
        const start = new Date(String((item as { date_init?: unknown })?.date_init || ''));
        if (!Number.isFinite(start.getTime())) return null;
        if (!first || start < first) first = start;
    }
    return first;
}

export function decideActivityCharge(input: {
    charge: Charge;
    userCharges: Charge[];
    activity: SeatActivity | null | undefined;
    now: Date;
}): SeatDecision {
    const { charge, userCharges, activity, now } = input;
    if (!activity) return { action: 'ignore', reason: 'activity_missing' };
    if (activity.isFree === true || activity.isFree === 1) return { action: 'ignore', reason: 'free' };
    const startsAt = activityStartsAt(activity);
    if (!startsAt || startsAt <= now) return { action: 'ignore', reason: 'started' };
    if (!isActivityChargeOpen(charge)) return { action: 'ignore', reason: 'not_open' };
    if (!isActivityChargeExpired(charge, now)) return { action: 'ignore', reason: 'within_hold' };
    // Quem saiu e se inscreveu de novo não pode perder a vaga por causa da cobrança antiga.
    const hasOtherValid = userCharges.some((other) => (
        other !== charge &&
        other?._type === 'activity' &&
        String(other?._eventID) === String(charge._eventID) &&
        (isActivityChargePaid(other) || (isActivityChargeOpen(other) && !isActivityChargeExpired(other, now)))
    ));
    if (hasOtherValid) return { action: 'ignore', reason: 'other_valid_charge' };
    return { action: 'check' };
}

/** O que fazer depois de consultar a cobrança no Asaas. */
export function decideFromGateway(record: Record<string, unknown> | null): GatewayDecision {
    if (!record) return 'retry';
    const status = String(record.status || '').toUpperCase();
    if (record.deleted === true || status === 'DELETED') return 'apply_deleted';
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) return 'apply_received';
    if (['PENDING', 'OVERDUE'].includes(status)) return 'delete';
    return 'retry';
}

export interface SeatReleaseDetail {
    userId: string;
    activityId: string;
    activityName: string;
    paymentId: string;
    storedStatus: string;
    gatewayStatus: string | null;
    outcome: 'released' | 'confirmed' | 'would_release' | 'would_confirm' | 'failed';
}

export interface SeatReleaseReport {
    released: number;
    confirmed: number;
    ignored: number;
    failed: number;
    pendingNextRound: number;
    details: SeatReleaseDetail[];
}

export interface SeatReleaseOptions {
    apiUrl: string;
    apiKey: string;
    now?: Date;
    /** Máximo de cobranças consultadas no Asaas por rodada. */
    limit?: number;
    /** Date.now() limite para parar a rodada. */
    deadline?: number;
    /** Só consulta o Asaas e relata; não exclui nem grava nada. */
    dryRun?: boolean;
    /** Aplica um evento do Asaas pelo mesmo caminho do webhook (webhook perdido). */
    applyLegacyEvent: (payload: { event: string; payment: Record<string, unknown> }) => Promise<unknown>;
    fetchImpl?: typeof fetch;
}

export async function releaseUnpaidActivitySeats(
    db: Db,
    options: SeatReleaseOptions,
): Promise<SeatReleaseReport> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? 20;
    const doFetch = options.fetchImpl ?? fetch;
    const apiUrl = options.apiUrl.replace(/\/+$/, '');
    const report: SeatReleaseReport = { released: 0, confirmed: 0, ignored: 0, failed: 0, pendingNextRound: 0, details: [] };

    const activities = await db.collection('minicursos')
        .find({}, { projection: { name: 1, timeline: 1, isFree: 1 } })
        .toArray();
    const byId = new Map<string, SeatActivity>();
    for (const activity of activities) {
        if (activity.isFree === true || activity.isFree === 1) continue;
        const startsAt = activityStartsAt(activity);
        if (startsAt && startsAt > now) byId.set(String(activity._id), activity);
    }
    if (byId.size === 0) return report;

    const users = await db.collection('usuarios')
        .find(
            { 'pagamento.lista_pagamentos': { $elemMatch: { _type: 'activity', _eventID: { $in: [...byId.keys()] } } } },
            { projection: { 'pagamento.lista_pagamentos': 1 } },
        )
        .toArray();

    let checked = 0;
    for (const user of users) {
        const userCharges: Charge[] = Array.isArray(user?.pagamento?.lista_pagamentos)
            ? user.pagamento.lista_pagamentos
            : [];
        for (const charge of userCharges) {
            if (charge?._type !== 'activity' || !byId.has(String(charge._eventID))) continue;
            const activity = byId.get(String(charge._eventID));
            const decision = decideActivityCharge({ charge, userCharges, activity, now });
            if (decision.action === 'ignore') {
                report.ignored += 1;
                continue;
            }
            const paymentId = typeof charge.id === 'string' ? charge.id : '';
            if (!paymentId) {
                report.ignored += 1;
                continue;
            }
            if (checked >= limit || (options.deadline && Date.now() >= options.deadline)) {
                report.pendingNextRound += 1;
                continue;
            }
            checked += 1;

            const detail: SeatReleaseDetail = {
                userId: String(user._id),
                activityId: String(charge._eventID),
                activityName: String(activity?.name || ''),
                paymentId,
                storedStatus: String(charge.status || ''),
                gatewayStatus: null,
                outcome: 'failed',
            };
            try {
                const headers = asaasRequestHeaders(options.apiKey, { apiUrl });
                const lookup = await doFetch(`${apiUrl}/payments/${encodeURIComponent(paymentId)}`, {
                    headers,
                    signal: AbortSignal.timeout(8_000),
                });
                const record = lookup.ok
                    ? (await lookup.json().catch(() => null)) as Record<string, unknown> | null
                    : null;
                detail.gatewayStatus = record
                    ? (record.deleted === true ? 'DELETED' : String(record.status || ''))
                    : `HTTP ${lookup.status}`;
                const gateway = decideFromGateway(record);

                if (gateway === 'apply_received') {
                    if (!options.dryRun) {
                        await options.applyLegacyEvent({ event: 'PAYMENT_RECEIVED', payment: { ...record, status: 'RECEIVED' } });
                    }
                    detail.outcome = options.dryRun ? 'would_confirm' : 'confirmed';
                    report.confirmed += 1;
                } else if (gateway === 'apply_deleted') {
                    if (!options.dryRun) {
                        await options.applyLegacyEvent({ event: 'PAYMENT_DELETED', payment: { ...record, deleted: true } });
                    }
                    detail.outcome = options.dryRun ? 'would_release' : 'released';
                    report.released += 1;
                } else if (gateway === 'delete') {
                    if (options.dryRun) {
                        detail.outcome = 'would_release';
                        report.released += 1;
                    } else {
                        const removal = await doFetch(`${apiUrl}/payments/${encodeURIComponent(paymentId)}`, {
                            method: 'DELETE',
                            headers,
                            signal: AbortSignal.timeout(8_000),
                        });
                        const payload = await removal.json().catch(() => null);
                        if (gatewayDeletionWasConfirmed(removal.ok, payload)) {
                            // O webhook PAYMENT_DELETED faz a remoção. Se ele se perder, a próxima rodada
                            // encontra a cobrança já excluída e aplica o evento.
                            detail.outcome = 'released';
                            report.released += 1;
                        } else {
                            report.failed += 1;
                        }
                    }
                } else {
                    report.failed += 1;
                }
            } catch (error) {
                console.error(`Falha ao liberar a vaga da cobrança ${paymentId}:`, error);
                report.failed += 1;
            }
            report.details.push(detail);
        }
    }
    return report;
}
