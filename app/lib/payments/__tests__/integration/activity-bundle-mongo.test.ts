import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as luxon from 'luxon';
import ts from 'typescript';
import * as activityBundle from '../../../activity-bundle.js';
import * as activityChargeState from '../../../activity-charge-state.js';
import * as scheduleConflict from '../../../schedule-conflict.js';

// Rotas reais de inscrição/compra de atividade contra um Mongo em memória (replica set).
// Asaas e Auth0 são falsos: nenhuma chamada sai da máquina.
let replicaSet: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
const TEST_DATABASE_NAME = `activity_tests_${randomUUID().replaceAll('-', '')}`;

before(async () => {
    replicaSet = await MongoMemoryReplSet.create({
        binary: { version: process.env.MONGOMS_VERSION || '8.0.13' },
        replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    client = new MongoClient(replicaSet.getUri());
    await client.connect();
});

after(async () => {
    await client?.close();
    await replicaSet?.stop();
});

const ids = {
    teoriaAvulsa: new ObjectId(),
    teoriaPacote: new ObjectId(),
    simulacaoT1: new ObjectId(),
    simulacaoT2: new ObjectId(),
    turma1: new ObjectId(),
    turma2: new ObjectId(),
};

const slot = (day: number, start: string, end: string) => [{
    date_init: `2026-11-${day}T${start}:00-03:00`,
    date_end: `2026-11-${day}T${end}:00-03:00`,
}];

beforeEach(async () => {
    if (
        !/^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\]):/.test(replicaSet.getUri()) ||
        !TEST_DATABASE_NAME.startsWith('activity_tests_')
    ) {
        throw new Error('Unsafe integration database target.');
    }
    db = client.db(TEST_DATABASE_NAME);
    await db.dropDatabase();
    const base = { showToUser: true, isOpen: true, dateOpen: '2026-01-01T19:00:00-03:00', participants: [], participantsCount: 0 };
    await db.collection('minicursos').insertMany([
        { ...base, _id: ids.teoriaAvulsa, name: 'TEORIA', isFree: true, maxParticipants: 80, timeline: slot(13, '07:00', '11:00') },
        { ...base, _id: ids.teoriaPacote, name: 'TEORIA (pacote)', isFree: false, somenteViaPacote: true, maxParticipants: 40, timeline: slot(13, '07:00', '11:00') },
        { ...base, _id: ids.simulacaoT1, name: 'Simulação T1', isFree: false, somenteViaPacote: true, maxParticipants: 20, timeline: slot(14, '20:30', '21:30') },
        { ...base, _id: ids.simulacaoT2, name: 'Simulação T2', isFree: false, somenteViaPacote: true, maxParticipants: 20, timeline: slot(14, '21:30', '22:30') },
        { ...base, _id: ids.turma1, name: 'TURMA 1', isFree: false, value: 55, maxParticipants: 20, timeline: slot(14, '08:00', '10:00'), incluiAtividades: [String(ids.teoriaPacote), String(ids.simulacaoT1)] },
        { ...base, _id: ids.turma2, name: 'TURMA 2', isFree: false, value: 55, maxParticipants: 20, timeline: slot(14, '14:00', '16:00'), incluiAtividades: [String(ids.teoriaPacote), String(ids.simulacaoT2)] },
    ]);
});

async function newUser() {
    const _id = new ObjectId();
    await db.collection('usuarios').insertOne({ _id, id_api: 'cus_ficticio', pagamento: { lista_pagamentos: [] } });
    return String(_id);
}

const asaas = { calls: 0, fail: false };

function loadRoute(path: string, method: string, userId: string) {
    const modules: Record<string, unknown> = {
        mongodb: { ObjectId },
        luxon,
        '@/lib/auth0-compat': {
            withApiAuthRequired: (handler: unknown) => handler,
            getSession: async () => ({ user: { sub: `auth0|${userId}` } }),
            publicErrorResponse: (message: string, status = 500) => Response.json({ message }, { status }),
        },
        '@/app/lib/mongodb': { connectToDatabase: async () => ({ db }) },
        '@/lib/payments/asaas': { asaasRequestHeaders: () => ({}) },
        '@/lib/payments/sales': { isPaymentSalesEnabled: () => true, paymentSalesPausedResponse: () => Response.json({}, { status: 503 }) },
        '@/lib/activity-bundle': activityBundle,
        '@/lib/schedule-conflict': scheduleConflict,
        '@/lib/activity-charge-state': activityChargeState,
    };
    const fakeFetch = async () => {
        asaas.calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (asaas.fail) return Response.json({ errors: [] }, { status: 400 });
        return Response.json({ id: `pay_${asaas.calls}`, invoiceUrl: `http://127.0.0.1/${asaas.calls}`, status: 'PENDING' });
    };
    const source = readFileSync(new URL(`../../../../api/${path}/route.js`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
    });
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    runInNewContext(outputText, {
        exports, Response, AbortSignal, console,
        fetch: fakeFetch,
        process: { env: { ASAAS_API_URL: 'http://127.0.0.1:4010/v3' } },
        require: (name: string) => {
            assert.ok(name in modules, `Unexpected dependency: ${name}`);
            return modules[name];
        },
    });
    return async (eventId: ObjectId) => {
        const response = await exports[method](new Request('http://localhost/api', {
            method, body: JSON.stringify({ eventId: String(eventId) }),
        }));
        return { status: response.status, body: await response.json() };
    };
}

const buy = (userId: string) => loadRoute('payment/createActivityPayment', 'POST', userId);
const enroll = (userId: string) => loadRoute('put/inscreverAtividade', 'PUT', userId);
const leave = (userId: string) => loadRoute('delete/desinscreverAtividade', 'DELETE', userId);

async function activity(id: ObjectId) {
    return db.collection('minicursos').findOne({ _id: id });
}

async function isIn(id: ObjectId, userId: string) {
    return (await activity(id))!.participants.includes(userId);
}

test('mesma conta comprando Turma 1 e Turma 2 em paralelo: só uma reserva e um PIX', async () => {
    for (let round = 0; round < 5; round++) {
        asaas.calls = 0;
        const userId = await newUser();
        const results = await Promise.all([buy(userId)(ids.turma1), buy(userId)(ids.turma2)]);
        const statuses = results.map((result) => result.status).sort();
        assert.equal(statuses.filter((status) => status === 200).length, 1, JSON.stringify(results));
        assert.ok([400, 409].includes(statuses.find((status) => status !== 200)!), JSON.stringify(results));
        assert.notEqual(await isIn(ids.turma1, userId), await isIn(ids.turma2, userId));
        assert.equal(asaas.calls, 1);
        const user = await db.collection('usuarios').findOne({ _id: new ObjectId(userId) });
        assert.equal(user!.pagamento.lista_pagamentos.length, 1);
    }
    assert.equal(await db.collection('minicursos.travas').countDocuments(), 0);
});

test('teórica avulsa em paralelo com a compra da Turma 1: a pessoa não fica nas duas', async () => {
    for (let round = 0; round < 5; round++) {
        const userId = await newUser();
        await Promise.all([enroll(userId)(ids.teoriaAvulsa), buy(userId)(ids.turma1)]);
        const both = (await isIn(ids.teoriaAvulsa, userId)) && (await isIn(ids.teoriaPacote, userId));
        assert.equal(both, false);
    }
});

test('trava vencida é reaproveitada; trava válida bloqueia', async () => {
    const userId = await newUser();
    await db.collection<{ _id: string }>('minicursos.travas').insertOne({ _id: userId, expiresAt: new Date(Date.now() - 1000) } as never);
    const release = await activityBundle.acquireRegistrationLock(db, userId);
    assert.ok(release);
    assert.equal(await activityBundle.acquireRegistrationLock(db, userId), null);
    const blocked = await buy(userId)(ids.turma1);
    assert.equal(blocked.status, 409);
    await release();
    assert.equal((await buy(userId)(ids.turma1)).status, 200);
});

test('estorno de uma turma (dentro de transação) não tira a teórica que pertence à outra turma', async () => {
    const userId = await newUser();
    // Estado que a corrida antiga deixava: duas turmas pagas com a mesma teórica do pacote.
    await db.collection('minicursos').updateMany(
        { _id: { $in: [ids.turma1, ids.turma2, ids.teoriaPacote, ids.simulacaoT1, ids.simulacaoT2] } },
        { $addToSet: { participants: userId } },
    );
    const refund = async (turma: ObjectId) => {
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                await db.collection('minicursos').updateOne({ _id: turma }, { $pull: { participants: userId } } as never, { session });
                await activityBundle.syncIncludedActivities(db, String(turma), userId, 'remove', session);
            });
        } finally {
            await session.endSession();
        }
    };
    await refund(ids.turma2);
    assert.equal(await isIn(ids.turma2, userId), false);
    assert.equal(await isIn(ids.simulacaoT2, userId), false);
    assert.equal(await isIn(ids.teoriaPacote, userId), true);
    assert.equal(await isIn(ids.simulacaoT1, userId), true);
    assert.equal(await isIn(ids.turma1, userId), true);
    await refund(ids.turma1);
    for (const id of Object.values(ids)) assert.equal(await isIn(id, userId), false);
});

test('participantsCount acompanha a lista em compra, desinscrição e falha do PIX', async () => {
    const counts = async () => Object.fromEntries(await Promise.all(
        Object.entries(ids).map(async ([name, id]) => {
            const doc = await activity(id);
            assert.equal(doc!.participantsCount, doc!.participants.length, name);
            return [name, doc!.participantsCount];
        }),
    ));
    const a = await newUser();
    assert.equal((await buy(a)(ids.turma1)).status, 200);
    assert.deepEqual(await counts(), { teoriaAvulsa: 0, teoriaPacote: 1, simulacaoT1: 1, simulacaoT2: 0, turma1: 1, turma2: 0 });

    const b = await newUser();
    assert.equal((await enroll(b)(ids.teoriaAvulsa)).status, 200);
    assert.equal((await activity(ids.teoriaAvulsa))!.participantsCount, 1);
    assert.equal((await leave(b)(ids.teoriaAvulsa)).status, 200);
    assert.equal((await activity(ids.teoriaAvulsa))!.participantsCount, 0);

    asaas.fail = true;
    try {
        const c = await newUser();
        const failed = await buy(c)(ids.turma2);
        assert.equal(failed.status, 500);
        assert.match(failed.body.message, /PIX/);
    } finally {
        asaas.fail = false;
    }
    assert.deepEqual(await counts(), { teoriaAvulsa: 0, teoriaPacote: 1, simulacaoT1: 1, simulacaoT2: 0, turma1: 1, turma2: 0 });
});

test('PIX da atividade: dentro dos 15 minutos devolve o mesmo; reserva expirada é renovada na mesma cobrança', async () => {
    asaas.calls = 0;
    const userId = await newUser();
    const charges = async () => (await db.collection('usuarios').findOne({ _id: new ObjectId(userId) }))!.pagamento.lista_pagamentos;
    const set = (fields: Record<string, unknown>) => db.collection('usuarios').updateOne(
        { _id: new ObjectId(userId) },
        { $set: Object.fromEntries(Object.entries(fields).map(([key, value]) => [`pagamento.lista_pagamentos.0.${key}`, value])) },
    );
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);
    const today = luxon.DateTime.now().setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd');

    const first = await buy(userId)(ids.turma1);
    assert.equal(first.status, 200);
    assert.ok((await charges())[0]._reservedAt instanceof Date, 'a reserva guarda o horário');
    assert.match(first.body.message, /15 minutos/);
    const again = await buy(userId)(ids.turma1);
    assert.equal(again.status, 200);
    assert.equal(again.body.link, first.body.link);
    assert.equal(asaas.calls, 1, 'PIX em aberto não gera outra cobrança');

    // passou dos 15 minutos no mesmo dia: renova a reserva sem chamar o Asaas
    await set({ _reservedAt: minutesAgo(20), dueDate: today });
    const sameDay = await buy(userId)(ids.turma1);
    assert.equal(sameDay.status, 200);
    assert.equal(asaas.calls, 1);
    assert.ok((await charges())[0]._reservedAt > minutesAgo(1));

    // venceu em outro dia: a mesma cobrança ganha vencimento novo no Asaas
    await set({ _reservedAt: minutesAgo(60 * 30), dueDate: '2026-01-01', status: 'PAYMENT_OVERDUE' });
    const renewed = await buy(userId)(ids.turma1);
    assert.equal(renewed.status, 200);
    assert.equal(asaas.calls, 2);
    const list = await charges();
    assert.equal(list.length, 1, 'a mesma cobrança é reaberta');
    assert.equal(list[0].id, 'pay_1');
    assert.equal(list[0].status, 'PENDING');
    assert.equal(list[0].dueDate, today);
    assert.equal((await activity(ids.turma1))!.participants.filter((id: string) => id === userId).length, 1);

    asaas.fail = true;
    try {
        await set({ _reservedAt: minutesAgo(60 * 30), dueDate: '2026-01-01', status: 'PAYMENT_OVERDUE' });
        assert.equal((await buy(userId)(ids.turma1)).status, 500);
        assert.equal((await charges())[0].status, 'PAYMENT_OVERDUE');
        assert.equal(await isIn(ids.turma1, userId), true, 'falha do Asaas não tira a vaga reservada');
    } finally {
        asaas.fail = false;
    }

    await set({ status: 'PAYMENT_RECEIVED' });
    assert.equal((await buy(userId)(ids.turma1)).status, 402);
});
