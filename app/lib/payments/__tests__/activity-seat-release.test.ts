import assert from 'node:assert/strict';
import test from 'node:test';
import type { Db } from 'mongodb';
import {
    activityStartsAt,
    decideActivityCharge,
    decideFromGateway,
    releaseUnpaidActivitySeats,
} from '../activity-seat-release.ts';

const AGORA = new Date('2026-11-11T15:00:00-03:00');
const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60 * 1000);
const atividade = (extra: Record<string, unknown> = {}) => ({
    _id: 'evento1',
    name: 'Minicurso pago',
    isFree: false,
    timeline: [{ date_init: '2026-11-14T08:00:00-03:00' }],
    ...extra,
});
const cobranca = (extra: Record<string, unknown> = {}) => ({
    _type: 'activity',
    _eventID: 'evento1',
    id: 'pay_1',
    status: 'PENDING',
    dueDate: '2026-11-11',
    _reservedAt: minutosAtras(20),
    ...extra,
});
const decidir = (charge: Record<string, unknown>, activity: unknown = atividade(), outras: Record<string, unknown>[] = []) =>
    decideActivityCharge({ charge, userCharges: [charge, ...outras], activity: activity as never, now: AGORA });

test('reserva de 15 minutos vencida sem pagamento: confere no Asaas para liberar', () => {
    assert.deepEqual(decidir(cobranca()), { action: 'check' });
});

test('dentro dos 15 minutos não mexe', () => {
    assert.deepEqual(decidir(cobranca({ _reservedAt: minutosAtras(14) })), { action: 'ignore', reason: 'within_hold' });
});

test('paga, estornada ou cancelada no banco não mexe', () => {
    for (const status of ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED', 'PAYMENT_DELETED']) {
        assert.deepEqual(decidir(cobranca({ status })), { action: 'ignore', reason: 'not_open' });
    }
});

test('atividade em andamento, encerrada, sem data, gratuita ou inexistente não mexe', () => {
    assert.equal(decidir(cobranca(), atividade({ timeline: [{ date_init: '2026-11-11T14:00:00-03:00' }] })).action, 'ignore');
    assert.deepEqual(decidir(cobranca(), atividade({ timeline: [] })), { action: 'ignore', reason: 'started' });
    assert.deepEqual(decidir(cobranca(), atividade({ timeline: [{ date_init: 'data ruim' }] })), { action: 'ignore', reason: 'started' });
    assert.deepEqual(decidir(cobranca(), atividade({ isFree: 1 })), { action: 'ignore', reason: 'free' });
    assert.deepEqual(decidir(cobranca(), null), { action: 'ignore', reason: 'activity_missing' });
});

test('quem tem outra cobrança paga ou no prazo da mesma atividade não perde a vaga', () => {
    const paga = cobranca({ id: 'pay_2', status: 'PAYMENT_RECEIVED' });
    const noPrazo = cobranca({ id: 'pay_3', _reservedAt: minutosAtras(2) });
    const outraAtividade = cobranca({ id: 'pay_4', _eventID: 'evento2', status: 'PAYMENT_RECEIVED' });
    assert.deepEqual(decidir(cobranca(), atividade(), [paga]), { action: 'ignore', reason: 'other_valid_charge' });
    assert.deepEqual(decidir(cobranca(), atividade(), [noPrazo]), { action: 'ignore', reason: 'other_valid_charge' });
    assert.deepEqual(decidir(cobranca(), atividade(), [outraAtividade]), { action: 'check' });
});

test('cobrança antiga, sem horário da reserva: só depois do dia do vencimento', () => {
    assert.equal(decidir(cobranca({ _reservedAt: undefined })).action, 'ignore');
    assert.deepEqual(decidir(cobranca({ _reservedAt: undefined, dueDate: '2026-11-10' })), { action: 'check' });
    assert.deepEqual(decidir(cobranca({ _reservedAt: undefined, status: 'PAYMENT_OVERDUE' })), { action: 'check' });
});

test('primeiro horário da atividade', () => {
    const duas = atividade({ timeline: [{ date_init: '2026-11-14T20:30:00-03:00' }, { date_init: '2026-11-13T07:00:00-03:00' }] });
    assert.equal(activityStartsAt(duas)?.toISOString(), new Date('2026-11-13T07:00:00-03:00').toISOString());
    assert.equal(activityStartsAt({ _id: 'x' }), null);
});

test('resposta do Asaas decide a ação', () => {
    assert.equal(decideFromGateway(null), 'retry');
    assert.equal(decideFromGateway({ status: 'PENDING' }), 'delete');
    assert.equal(decideFromGateway({ status: 'OVERDUE' }), 'delete');
    assert.equal(decideFromGateway({ status: 'RECEIVED' }), 'apply_received');
    assert.equal(decideFromGateway({ status: 'CONFIRMED' }), 'apply_received');
    assert.equal(decideFromGateway({ status: 'PENDING', deleted: true }), 'apply_deleted');
    assert.equal(decideFromGateway({ status: 'REFUNDED' }), 'retry');
});

function bancoFalso(minicursos: unknown[], usuarios: unknown[]) {
    return {
        collection: (nome: string) => ({
            find: () => ({ toArray: async () => (nome === 'minicursos' ? minicursos : usuarios) }),
        }),
    } as unknown as Db;
}

function asaasFalso(cobrancas: Record<string, Record<string, unknown> | null>) {
    const chamadas: string[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
        const id = String(url).split('/').pop() as string;
        const metodo = init?.method || 'GET';
        chamadas.push(`${metodo} ${id}`);
        const registro = cobrancas[id];
        if (!registro) return Response.json({ errors: [] }, { status: 404 });
        if (metodo === 'DELETE') return Response.json({ deleted: true, id });
        return Response.json(registro);
    }) as typeof fetch;
    return { chamadas, fetchImpl };
}

test('rodada: exclui a vencida, confirma a paga com webhook perdido, respeita limite e dry-run', async () => {
    const usuarios = [
        { _id: 'u1', pagamento: { lista_pagamentos: [cobranca({ id: 'pay_vencida' })] } },
        { _id: 'u2', pagamento: { lista_pagamentos: [cobranca({ id: 'pay_paga_no_asaas' })] } },
        { _id: 'u3', pagamento: { lista_pagamentos: [cobranca({ id: 'pay_no_prazo', _reservedAt: minutosAtras(3) })] } },
        { _id: 'u4', pagamento: { lista_pagamentos: [cobranca({ id: 'pay_ja_excluida' })] } },
        { _id: 'u5', pagamento: { lista_pagamentos: [cobranca({ id: 'pay_sumiu' })] } },
    ];
    const gateway = {
        pay_vencida: { id: 'pay_vencida', status: 'PENDING' },
        pay_paga_no_asaas: { id: 'pay_paga_no_asaas', status: 'RECEIVED' },
        pay_ja_excluida: { id: 'pay_ja_excluida', status: 'PENDING', deleted: true },
        pay_sumiu: null,
    };
    const eventos: string[] = [];
    const rodar = (extra: Record<string, unknown>, asaas = asaasFalso(gateway)) => releaseUnpaidActivitySeats(
        bancoFalso([atividade()], usuarios),
        {
            apiUrl: 'http://asaas.test/v3',
            apiKey: 'chave',
            now: AGORA,
            fetchImpl: asaas.fetchImpl,
            applyLegacyEvent: async (payload) => { eventos.push(`${payload.event} ${payload.payment.id}`); },
            ...extra,
        },
    ).then((report) => ({ report, chamadas: asaas.chamadas }));

    const ensaio = await rodar({ dryRun: true });
    assert.equal(ensaio.chamadas.some((chamada) => chamada.startsWith('DELETE')), false, 'dry-run não exclui');
    assert.deepEqual(eventos, [], 'dry-run não grava');
    assert.equal(ensaio.report.released, 2);
    assert.equal(ensaio.report.confirmed, 1);

    const real = await rodar({});
    assert.deepEqual(real.chamadas.filter((chamada) => chamada.startsWith('DELETE')), ['DELETE pay_vencida']);
    assert.deepEqual(eventos, ['PAYMENT_RECEIVED pay_paga_no_asaas', 'PAYMENT_DELETED pay_ja_excluida']);
    assert.deepEqual(
        { released: real.report.released, confirmed: real.report.confirmed, ignored: real.report.ignored, failed: real.report.failed },
        { released: 2, confirmed: 1, ignored: 1, failed: 1 },
    );

    const limitada = await rodar({ limit: 1, dryRun: true });
    assert.equal(limitada.chamadas.length, 1);
    assert.equal(limitada.report.pendingNextRound, 3);
});

test('rodada: sem atividade paga futura não consulta nada', async () => {
    const asaas = asaasFalso({});
    const report = await releaseUnpaidActivitySeats(
        bancoFalso([atividade({ timeline: [{ date_init: '2026-11-01T08:00:00-03:00' }] })], []),
        { apiUrl: 'http://asaas.test/v3', apiKey: 'chave', now: AGORA, fetchImpl: asaas.fetchImpl, applyLegacyEvent: async () => { } },
    );
    assert.equal(asaas.chamadas.length, 0);
    assert.equal(report.released, 0);
});
