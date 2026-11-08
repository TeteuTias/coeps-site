import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { syncIncludedActivities } from '../activity-bundle.js';

const praticaId = new ObjectId();
const teoricaId = new ObjectId();
const simulacaoId = new ObjectId();

function fakeDb(activity: any) {
    const calls: any[] = [];
    const db = {
        collection: () => ({
            findOne: async () => activity,
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
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].filter._id.$in.map(String), [String(teoricaId), String(simulacaoId)]);
    assert.deepEqual(calls[0].update, { $addToSet: { participants: 'user-1' } });
    assert.equal(calls[0].options.session, session);
});

test('remove o usuário das atividades incluídas', async () => {
    const { db, calls } = fakeDb({ _id: praticaId, incluiAtividades: [String(teoricaId)] });
    await syncIncludedActivities(db, String(praticaId), 'user-1', 'remove');
    assert.deepEqual(calls[0].update, { $pull: { participants: 'user-1' } });
});

test('atividade sem pacote não altera nada', async () => {
    for (const activity of [null, { _id: praticaId }, { _id: praticaId, incluiAtividades: ['invalido'] }]) {
        const { db, calls } = fakeDb(activity);
        assert.equal(await syncIncludedActivities(db, praticaId, 'user-1', 'add'), 0);
        assert.equal(calls.length, 0);
    }
});
