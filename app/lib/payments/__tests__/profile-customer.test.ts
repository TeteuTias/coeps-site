import test from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { ensureProfileCustomer } from '../customer-profile-sync.ts';

const owner = new ObjectId('507f1f77bcf86cd799439011');
const userId = owner.toHexString();
const apiUrl = 'https://api-sandbox.asaas.com/v3';
const apiKey = 'test-key';

const healthProfile = {
    isPos_registration: true,
    informacoes_usuario: {
        nome: 'Maria da Silva',
        cpf: '52998224725',
        email: 'maria@example.com',
        numero_telefone: '(34) 99999-9999',
        endereco: { postalCode: '38440000', address: 'Rua A', addressNumber: '120', province: 'Centro' },
    },
};

function fakeDb(user: Record<string, unknown> | null) {
    const userUpdates: Array<Record<string, any>> = [];
    const db = {
        collection(name: string) {
            if (name === 'usuarios') {
                return {
                    async findOne() { return user; },
                    async updateOne(_filter: unknown, update: Record<string, any>) {
                        userUpdates.push(update);
                        return { matchedCount: 1 };
                    },
                };
            }
            // Coleção de provisionamento do Customer: sem registro anterior.
            return {
                async findOneAndUpdate() { return {}; },
                async findOne() { return null; },
                async updateOne() { return { matchedCount: 1 }; },
            };
        },
    } as unknown as Db;
    return { db, userUpdates };
}

function fetchRecorder(responses: Response[]) {
    const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
            method: init?.method || 'GET',
            url: String(input),
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        const next = responses.shift();
        assert.ok(next, 'chamada inesperada ao Asaas');
        return next;
    }) as typeof fetch;
    return { calls, fetchImpl };
}

test('usuário com id_api usa o Customer gravado sem chamar o Asaas', async () => {
    const { db } = fakeDb({ ...healthProfile, id_api: 'cus_stored' });
    const { calls, fetchImpl } = fetchRecorder([]);
    const result = await ensureProfileCustomer({ db, owner, userId, apiUrl, apiKey, fetchImpl });
    assert.deepEqual(result, { ok: true, customerId: 'cus_stored' });
    assert.equal(calls.length, 0);
});

test('profissional por cortesia sem id_api ganha Customer criado com os dados do cadastro', async () => {
    const { db, userUpdates } = fakeDb({ ...healthProfile, id_api: '' });
    const { calls, fetchImpl } = fetchRecorder([
        Response.json({ data: [] }),
        Response.json({ id: 'cus_new' }),
    ]);
    const result = await ensureProfileCustomer({ db, owner, userId, apiUrl, apiKey, fetchImpl });

    assert.deepEqual(result, { ok: true, customerId: 'cus_new' });
    assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST']);
    const created = calls[1].body!;
    assert.equal(created.cpfCnpj, '52998224725');
    assert.equal(created.externalReference, userId);
    assert.equal(created.postalCode, '38440000');
    assert.equal(created.address, 'Rua A');
    assert.equal(created.province, 'Centro');
    assert.equal(userUpdates.at(-1)?.$set?.id_api, 'cus_new');
});

test('cadastro sem CPF não chama o Asaas e pede para completar os dados', async () => {
    const { db } = fakeDb({
        ...healthProfile,
        informacoes_usuario: { ...healthProfile.informacoes_usuario, cpf: '' },
    });
    const { calls, fetchImpl } = fetchRecorder([]);
    const result = await ensureProfileCustomer({ db, owner, userId, apiUrl, apiKey, fetchImpl });
    assert.deepEqual(result, { ok: false, reason: 'PROFILE_INCOMPLETE' });
    assert.equal(calls.length, 0);
});

test('cadastro inicial não concluído conta como incompleto', async () => {
    const { db } = fakeDb({ ...healthProfile, isPos_registration: false });
    const { calls, fetchImpl } = fetchRecorder([]);
    const result = await ensureProfileCustomer({ db, owner, userId, apiUrl, apiKey, fetchImpl });
    assert.deepEqual(result, { ok: false, reason: 'PROFILE_INCOMPLETE' });
    assert.equal(calls.length, 0);
});

test('Asaas recusando a criação não grava id_api', async () => {
    const { db, userUpdates } = fakeDb({ ...healthProfile });
    const { fetchImpl } = fetchRecorder([
        Response.json({ data: [] }),
        Response.json({ errors: [{ code: 'invalid_cpfCnpj' }] }, { status: 400 }),
    ]);
    const result = await ensureProfileCustomer({ db, owner, userId, apiUrl, apiKey, fetchImpl });
    assert.deepEqual(result, { ok: false, reason: 'CUSTOMER_FAILED' });
    assert.equal(userUpdates.length, 0);
});
