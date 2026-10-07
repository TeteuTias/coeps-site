import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ObjectId } from 'mongodb';
import type { Db, Document } from 'mongodb';
import { ensureAuthenticatedUser } from '../authenticated-user.ts';
import { getRegistrationRedirect, isRegistrationProfileComplete } from '../registration-gate.ts';

const identity = { sub: 'auth0|507f1f77bcf86cd799439011', email: 'conta@example.test' };
const firstAccess = new Date('2026-10-06T12:00:00Z');

// Somente memória: não instancia MongoClient nem abre conexão com MongoDB.
function memoryDb(initial?: Document, beforeWrite?: (documents: Map<string, Document>) => void) {
    const documents = new Map<string, Document>();
    if (initial) documents.set('507f1f77bcf86cd799439011', initial);
    let writes = 0;
    let collections = 0;
    const db = {
        collection(name: string) {
            collections += 1;
            assert.equal(name, 'usuarios');
            return {
                async findOne(filter: { _id: ObjectId }) {
                    return documents.get(filter._id.toHexString()) ?? null;
                },
                async updateOne(filter: { _id: ObjectId }, update: Document, options: Document) {
                    writes += 1;
                    assert.deepEqual(Object.keys(update), ['$setOnInsert']);
                    assert.deepEqual(options, { upsert: true });
                    beforeWrite?.(documents);
                    const id = filter._id.toHexString();
                    if (!documents.has(id)) documents.set(id, { _id: filter._id, ...update.$setOnInsert });
                    return { acknowledged: true };
                },
            };
        },
    } as unknown as Db;
    return { db, documents, writes: () => writes, collections: () => collections };
}

test('primeiro acesso cria conta administrável pelo e-mail, sem liberar cadastro ou cobrança', async () => {
    const store = memoryDb();
    const user = await ensureAuthenticatedUser(store.db, identity, firstAccess);
    assert.equal(user._id.toHexString(), '507f1f77bcf86cd799439011');
    assert.equal(user.informacoes_usuario.email, identity.email);
    assert.equal(user.informacoes_usuario.nome, '');
    assert.equal(user.informacoes_usuario.cpf, '');
    assert.equal(user.informacoes_usuario.numero_telefone, '');
    assert.equal(user.informacoes_usuario.data_criacao, firstAccess);
    assert.equal(user.id_api, '');
    assert.equal(user.isPos_registration, false);
    assert.equal(user.consentimentos, undefined);
    assert.equal(user.pagamento.situacao, 0);
    assert.equal(user.pagamento.situacao_animacao, false);
    assert.deepEqual(user.pagamento.lista_pagamentos, []);
    assert.equal(isRegistrationProfileComplete({
        isPos_registration: user.isPos_registration,
        informacoes_usuario: user.informacoes_usuario,
    }), false);
    assert.equal(getRegistrationRedirect({ path: '/painel/dadosIniciais', profileComplete: false, paymentConfirmed: false, confirmationSeen: false }), '/pagamentos');
});

test('acessos repetidos preservam data, e-mail e documento sem novas escritas', async () => {
    const store = memoryDb();
    const created = await ensureAuthenticatedUser(store.db, identity, firstAccess);
    const existing = await ensureAuthenticatedUser(store.db, { ...identity, email: 'outro@example.test' }, new Date());
    assert.equal(existing, created);
    assert.equal(existing.informacoes_usuario.email, identity.email);
    assert.equal(existing.informacoes_usuario.data_criacao, firstAccess);
    assert.equal(store.writes(), 1);
});

test('cadastro pago ou legado parcial é retornado integralmente sem escrita', async () => {
    for (const initial of [
        { _id: new ObjectId('507f1f77bcf86cd799439011'), informacoes_usuario: {}, pagamento: { situacao: 2 } },
        { _id: new ObjectId('507f1f77bcf86cd799439011'), id_api: 'cus_original', isPos_registration: true,
            informacoes_usuario: { nome: 'Nome cadastrado', email: 'original@example.test', data_criacao: firstAccess },
            pagamento: { situacao: 1, compraId: new ObjectId(), lista_pagamentos: [{ id: 'pay_original' }] },
            consentimentos: { lgpd: { aceito: true } } },
        { _id: new ObjectId('507f1f77bcf86cd799439011'), informacoes_usuario: 'legado', pagamento: ['legado'] },
    ]) {
        const snapshot = structuredClone(initial);
        const store = memoryDb(initial);
        assert.equal(await ensureAuthenticatedUser(store.db, identity), initial);
        assert.deepEqual(structuredClone(initial), snapshot);
        assert.equal(store.writes(), 0);
    }
});

test('acessos concorrentes convergem no mesmo documento e mantêm a primeira data', async () => {
    const store = memoryDb();
    const users = await Promise.all(Array.from({ length: 20 }, (_, index) =>
        ensureAuthenticatedUser(store.db, identity, new Date(firstAccess.getTime() + index)),
    ));
    assert.equal(store.documents.size, 1);
    assert.ok(users.every(user => user === users[0]));
    assert.deepEqual(users[0].informacoes_usuario.data_criacao, firstAccess);
});

test('colisão com escritor financeiro relê o registro sem substituir pagamento', async () => {
    const paid = { _id: new ObjectId('507f1f77bcf86cd799439011'), pagamento: { situacao: 1 }, id_api: 'cus_original' };
    const store = memoryDb(undefined, documents => {
        documents.set(paid._id.toHexString(), paid);
        throw { code: 11000 };
    });
    assert.equal(await ensureAuthenticatedUser(store.db, identity), paid);
});

test('identidade ausente ou inválida não acessa sequer a coleção', async () => {
    const store = memoryDb();
    for (const sub of [undefined, null, '', 'auth0|invalid', 'google-oauth2|507f1f77bcf86cd799439011', {}, '507f1f77bcf86cd799439011']) {
        await assert.rejects(ensureAuthenticatedUser(store.db, { sub }));
    }
    assert.equal(store.collections(), 0);
});

test('valores de sessão são literais e ausência de e-mail não inventa dados', async () => {
    const store = memoryDb();
    const user = await ensureAuthenticatedUser(store.db, { ...identity, email: '$$REMOVE' });
    assert.equal(user.informacoes_usuario.email, '$$REMOVE');
    const withoutEmail = await ensureAuthenticatedUser(memoryDb().db, { sub: identity.sub });
    assert.equal(withoutEmail.informacoes_usuario.email, '');
});

test('falhas de escrita e colisões sem documento persistido são propagadas', async () => {
    const failure = new Error('write unavailable');
    const store = memoryDb(undefined, () => { throw failure; });
    await assert.rejects(ensureAuthenticatedUser(store.db, identity), error => error === failure);
    const collision = memoryDb(undefined, () => { throw { code: 11000 }; });
    await assert.rejects(ensureAuthenticatedUser(collision.db, identity), /not persisted/);
});

// Executa o proxy real com dependências substituídas, sem Auth0, Asaas ou banco real.
function proxyHarness(options: { user?: typeof identity | { sub: unknown }; failure?: boolean; writeFailure?: boolean } = {}) {
    const store = memoryDb(undefined, () => {
        if (options.writeFailure) throw new Error('write unavailable');
    });
    let connections = 0;
    const modules = {
        'next/server': { NextResponse: {
            json: Response.json,
            next: () => new Response(null, { status: 200 }),
            redirect: (url: URL) => new Response(null, { status: 307, headers: { location: String(url) } }),
        } },
        './app/lib/auth0': { isAuth0Configured: true, getAuth0Client: () => ({
            getSession: async () => options.user ? { user: options.user } : null,
            startInteractiveLogin: async () => new Response(null, { status: 302 }),
            middleware: async () => new Response(null, { status: 200 }),
        }) },
        '@/lib/mongodb': { connectToDatabase: async () => {
            connections += 1;
            if (options.failure) throw new Error('database unavailable');
            return { db: store.db };
        } },
        bson: { ObjectId },
        '@/lib/auth-migration-notice': {
            AUTH_MIGRATION_GATE_COOKIE_NAME: 'gate',
            isAuthMigrationGateSatisfied: () => true,
            buildAuthEntryPath: () => '/entrada',
        },
        '@/lib/registration-gate': { getRegistrationRedirect, isRegistrationProfileComplete },
        '@/lib/payments/config': { getActivePaymentConfig: async () => null },
        '@/lib/remote-work-access': { findRemoteWorkAccess: async () => null },
        '@/lib/authenticated-user': { ensureAuthenticatedUser },
    };
    const source = readFileSync(new URL('../../../proxy.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const exports: { proxy?: (request: unknown) => Promise<Response> } = {};
    runInNewContext(outputText, { exports, require: (name: string) => {
        assert.ok(name in modules, `Unexpected dependency: ${name}`);
        return modules[name];
    }, URL });
    const request = (path = '/pagamentos') => exports.proxy({
        nextUrl: { pathname: path, search: '', origin: 'https://example.test' },
        cookies: { get: () => undefined },
    });
    return { ...store, request, connections: () => connections };
}

test('proxy provisiona no acesso a pagamentos antes de qualquer cobrança', async () => {
    const harness = proxyHarness({ user: identity });
    assert.equal((await harness.request()).status, 200);
    assert.equal(harness.documents.size, 1);
    assert.equal(harness.documents.values().next().value.informacoes_usuario.email, identity.email);
});

test('proxy mantém bloqueio do formulário para a nova conta não paga', async () => {
    const response = await proxyHarness({ user: identity }).request('/painel/dadosIniciais');
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://example.test/pagamentos');
});

test('proxy não conecta para sessão ausente, identidade inválida ou página pública', async () => {
    for (const options of [{}, { user: { sub: 'auth0|invalid' } }, { user: { sub: {} } }]) {
        const harness = proxyHarness(options);
        assert.equal((await harness.request()).status, 302);
        assert.equal(harness.connections(), 0);
    }
    const publicPage = proxyHarness({ user: identity });
    assert.equal((await publicPage.request('/')).status, 200);
    assert.equal(publicPage.connections(), 0);
});

test('proxy retorna 503 temporário quando não consegue preparar a conta', async () => {
    for (const options of [{ failure: true }, { writeFailure: true }]) {
        const response = await proxyHarness({ user: identity, ...options }).request();
        assert.equal(response.status, 503);
        assert.equal((await response.json()).error, 'user_provisioning_unavailable');
    }
});
