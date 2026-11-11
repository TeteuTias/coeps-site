import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { acquireRegistrationLock, syncIncludedActivities } from '../activity-bundle.js';

const praticaId = new ObjectId();
const teoricaId = new ObjectId();
const simulacaoId = new ObjectId();

function fakeDb(activity: any, otherBundles: any[] = []) {
    const calls: any[] = [];
    const db = {
        collection: () => ({
            findOne: async () => activity,
            find: () => ({ toArray: async () => otherBundles }),
            updateMany: async (filter: any, update: any, options: any) => {
                calls.push({ filter, update, options });
                return { modifiedCount: filter._id.$in.length };
            },
        }),
    };
    return { db, calls };
}

test('adiciona o usuário nas atividades incluídas do pacote', async () => {
    const { db, calls } = fakeDb({ _id: praticaId, incluiAtividades: [String(teoricaId), String(simulacaoId)] });
    const session = { id: 'sessao' };
    await syncIncludedActivities(db, praticaId, 'user-1', 'add', session);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].filter._id.$in.map(String), [String(teoricaId), String(simulacaoId)]);
    assert.deepEqual(calls[0].update, { $addToSet: { participants: 'user-1' } });
    assert.equal(calls[0].options.session, session);
});

test('remove o usuário das atividades incluídas', async () => {
    const { db, calls } = fakeDb({ _id: praticaId, incluiAtividades: [String(teoricaId)] });
    await syncIncludedActivities(db, String(praticaId), 'user-1', 'remove');
    assert.deepEqual(calls[0].update, { $pull: { participants: 'user-1' } });
});

test('atividade sem pacote não altera outras atividades', async () => {
    for (const activity of [null, { _id: praticaId }, { _id: praticaId, incluiAtividades: ['invalido'] }]) {
        const { db, calls } = fakeDb(activity);
        assert.equal(await syncIncludedActivities(db, praticaId, 'user-1', 'add'), 0);
        assert.ok(calls.every((call) => !call.update.$addToSet && !call.update.$pull));
    }
});

test('recalcula participantsCount da atividade principal e das incluídas pelo tamanho da lista', async () => {
    const { db, calls } = fakeDb({ _id: praticaId, incluiAtividades: [String(teoricaId), String(simulacaoId)] });
    await syncIncludedActivities(db, praticaId, 'user-1', 'remove');
    const refresh = calls.at(-1);
    assert.deepEqual(refresh.filter._id.$in.map(String), [String(praticaId), String(teoricaId), String(simulacaoId)]);
    assert.deepEqual(refresh.update, [{ $set: { participantsCount: { $size: { $ifNull: ['$participants', []] } } } }]);

    const semPacote = fakeDb({ _id: praticaId });
    await syncIncludedActivities(semPacote.db, praticaId, 'user-1', 'remove');
    assert.deepEqual(semPacote.calls.map((call) => call.filter._id.$in.map(String)), [[String(praticaId)]]);
});

test('estorno de uma turma mantém a etapa compartilhada que pertence a outra turma do usuário', async () => {
    const simulacaoT2 = new ObjectId();
    const outraTurma = { _id: new ObjectId(), incluiAtividades: [String(teoricaId), String(simulacaoId)] };
    const { db, calls } = fakeDb({ _id: praticaId, incluiAtividades: [String(teoricaId), String(simulacaoT2)] }, [outraTurma]);
    await syncIncludedActivities(db, praticaId, 'user-1', 'remove');
    assert.deepEqual(calls[0].filter._id.$in.map(String), [String(simulacaoT2)]);
    assert.deepEqual(calls[0].update, { $pull: { participants: 'user-1' } });
});

test('estorno não remove nada das incluídas quando todas ainda pertencem a outra turma', async () => {
    const outraTurma = { _id: new ObjectId(), incluiAtividades: [String(teoricaId)] };
    const { db, calls } = fakeDb({ _id: praticaId, incluiAtividades: [String(teoricaId)] }, [outraTurma]);
    assert.equal(await syncIncludedActivities(db, praticaId, 'user-1', 'remove'), 0);
    assert.ok(calls.every((call) => !call.update.$pull));
});

function fakeLockDb(updateOne: (filter: any, update: any, options: any) => Promise<unknown>) {
    const deletes: any[] = [];
    const db = {
        collection: (name: string) => {
            assert.equal(name, 'minicursos.travas');
            return { updateOne, deleteOne: async (filter: any) => { deletes.push(filter); } };
        },
    };
    return { db, deletes };
}

test('trava de inscrição: só pega quando não há trava válida e libera só a própria', async () => {
    let seen: any;
    const { db, deletes } = fakeLockDb(async (filter, update, options) => { seen = { filter, update, options }; });
    const release = await acquireRegistrationLock(db, 'user-1');
    assert.ok(release);
    assert.equal(seen.filter._id, 'user-1');
    assert.ok(seen.filter.expiresAt.$lte instanceof Date);
    assert.equal(seen.options.upsert, true);
    assert.ok(seen.update.$set.expiresAt > seen.filter.expiresAt.$lte);
    await release!();
    assert.deepEqual(deletes, [{ _id: 'user-1', token: seen.update.$set.token }]);
});

test('trava de inscrição: outra inscrição em andamento devolve null; outros erros sobem', async () => {
    const busy = fakeLockDb(async () => { throw Object.assign(new Error('dup'), { code: 11000 }); });
    assert.equal(await acquireRegistrationLock(busy.db, 'user-1'), null);
    const down = fakeLockDb(async () => { throw new Error('offline'); });
    await assert.rejects(acquireRegistrationLock(down.db, 'user-1'), /offline/);
});
