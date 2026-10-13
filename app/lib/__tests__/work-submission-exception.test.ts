import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ObjectId, type Document } from 'mongodb';
import ts from 'typescript';
import { getWorkSubmissionException } from '../work-submission-exception.ts';
import * as filesPolicy from '../academic-work-files.ts';
import * as submissionPolicy from '../academic-work-submission.ts';
import { runPaymentTransaction } from '../payments/transactions.ts';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439012';
const modalityId = '507f1f77bcf86cd799439013';
const fileId = '507f1f77bcf86cd799439014';
const editionId = 'CIEPS-2026';
const activatedAt = '2026-10-13T18:00:00-03:00';
const expiresAt = '2026-10-14T21:00:00.000Z';
const grant = { userId, editionId, activatedAt };
const config = {
    isOpen: false,
    data_inicio_submissao: '2026-09-01T00:00:00-03:00',
    data_limite_submissao: '2026-10-12T23:59:59-03:00',
    maximo_postagem_por_usuario: 2,
    modalidades: [{
        _id: new ObjectId(modalityId), modalidade: 'Resumo', autores_por_trabalho: 3,
        maximo_orientadores: 1, trabalhos_por_usuario: 2, limite_maximo_de_postagem: 1000,
        requisitos_arquivos: [{ titulo: 'Resumo', formatos: ['.pdf'] }],
    }],
};

function configure(t: { after: (fn: () => void) => void }, value: unknown = grant) {
    const previous = process.env.WORK_SUBMISSION_EXCEPTION;
    process.env.WORK_SUBMISSION_EXCEPTION = typeof value === 'string' ? value : JSON.stringify(value);
    t.after(() => {
        if (previous === undefined) delete process.env.WORK_SUBMISSION_EXCEPTION;
        else process.env.WORK_SUBMISSION_EXCEPTION = previous;
    });
}

test('a janela começa no horário configurado e termina exatamente após 24h', t => {
    configure(t);
    assert.equal(getWorkSubmissionException(userId, editionId, config, new Date('2026-10-13T20:59:59.999Z')), null);
    assert.equal(getWorkSubmissionException(userId, editionId, config, new Date(activatedAt))?.expiresAt.toISOString(), expiresAt);
    assert.ok(getWorkSubmissionException(userId, editionId, config, new Date('2026-10-14T20:59:59.999Z')));
    assert.equal(getWorkSubmissionException(userId, editionId, config, new Date(expiresAt)), null);
});

test('outra conta/edição, configuração inválida e período ainda não encerrado não liberam acesso', t => {
    configure(t);
    const now = new Date(activatedAt);
    assert.equal(getWorkSubmissionException(otherUserId, editionId, config, now), null);
    assert.equal(getWorkSubmissionException(userId, 'CIEPS-2027', config, now), null);
    assert.equal(getWorkSubmissionException(userId, editionId, { ...config, data_limite_submissao: expiresAt }, now), null);
    assert.equal(getWorkSubmissionException(userId, editionId, { ...config, data_limite_submissao: 'invalid' }, now), null);
    for (const value of ['', '{', 'null', '[]', JSON.stringify({ ...grant, userId: 'invalid' }),
        JSON.stringify({ ...grant, activatedAt: '2026-10-13T18:00:00' }),
        JSON.stringify({ ...grant, activatedAt: '2026-99-99T18:00:00Z' })]) {
        process.env.WORK_SUBMISSION_EXCEPTION = value;
        assert.equal(getWorkSubmissionException(userId, editionId, config, now), null);
    }
});

// Executes the actual routes with JS fixtures only. No MongoClient, MongoDB server,
// Auth0, Blob service or email service is instantiated or accessed.
function harness(options: {
    subject?: string | null; paid?: boolean; existingWork?: boolean; used?: boolean;
    open?: boolean; now?: string; failFileUpdate?: boolean; retryAt?: string;
    paymentConfigMissing?: boolean;
} = {}) {
    let clock = new Date(options.now ?? activatedAt);
    const ownerId = options.subject?.replace('auth0|', '') ?? userId;
    const works: Document[] = options.existingWork ? [{ userId: new ObjectId(ownerId), editionId }] : [];
    let lock: Document = { ...(options.used ? { submissionException: { submissionId: new ObjectId() } } : {}) };
    const files: Document[] = [{
        _id: new ObjectId(fileId), userId: ownerId, purpose: 'submission', originalName: 'resumo.pdf',
        size: 100, contentType: 'application/pdf', url: 'https://files.example/resumo.pdf', uploadDate: clock,
    }];
    const workConfig = options.open ? { ...config, isOpen: true, data_limite_submissao: expiresAt } : config;
    const sessionUser = options.subject === null ? null : { sub: options.subject ?? `auth0|${userId}`, email: 'author@example.test' };
    let inTransaction = false;
    let queued = Promise.resolve();
    let notifications = 0;
    let connections = 0;
    const assertSession = (opts: Document) => {
        assert.equal(inTransaction, true);
        assert.ok(opts?.session);
    };
    const db = {
        collection(name: string) {
            switch (name) {
                case 'trabalhos_config': return { findOne: async () => workConfig };
                case 'usuarios': return { findOne: async (filter: Document) => filter._id
                    ? { informacoes_usuario: { email: 'author@example.test' } }
                    : options.paid === false ? null : { _id: new ObjectId(ownerId) } };
                case 'trabalhos_submission_locks': return {
                    findOne: async (filter: Document) => {
                        assert.equal(filter.userId.toHexString(), ownerId);
                        assert.equal(filter.editionId, editionId);
                        return lock;
                    },
                    updateOne: async (filter: Document, update: Document, opts: Document) => {
                        assertSession(opts);
                        assert.equal(filter.userId.toHexString(), ownerId);
                        assert.equal(filter.editionId, editionId);
                        if (filter.submissionException?.$exists === false && Object.hasOwn(lock, 'submissionException')) {
                            return { matchedCount: 0 };
                        }
                        Object.assign(lock, update.$set);
                        return { matchedCount: 1 };
                    },
                };
                case 'Dados_do_trabalho': return {
                    findOne: async (filter: Document) => {
                        assert.equal(filter.userId.toHexString(), ownerId);
                        assert.equal(filter.$or[0].editionId, editionId);
                        return works[0] ?? null;
                    },
                    countDocuments: async (filter: Document, opts: Document) => {
                        assertSession(opts);
                        assert.equal(filter.userId.toHexString(), ownerId);
                        return works.length;
                    },
                    insertOne: async (doc: Document, opts: Document) => { assertSession(opts); works.push(doc); },
                };
                case 'trabalhos_blob': return {
                    find: (filter: Document, opts: Document) => {
                        assertSession(opts);
                        return { toArray: async () => files.filter(file => file.userId === filter.userId
                            && !file.submissionId && filter._id.$in.some((id: ObjectId) => id.equals(file._id))) };
                    },
                    updateMany: async (_filter: Document, update: Document, opts: Document) => {
                        assertSession(opts);
                        if (options.failFileUpdate) return { modifiedCount: 0 };
                        files.forEach(file => Object.assign(file, update.$set));
                        return { modifiedCount: files.length };
                    },
                };
                default: throw new Error(`Unexpected collection ${name}`);
            }
        },
    };
    const client = { startSession: () => ({
        async withTransaction(operation: () => Promise<void>) {
            // Simulates the serialization supplied by the existing MongoDB lock/index.
            // Rollback and retry are modeled explicitly; this is not live DB validation.
            const previous = queued;
            let release!: () => void;
            queued = new Promise<void>(resolve => { release = resolve; });
            await previous;
            const savedLock = { ...lock };
            const savedWorks = [...works];
            const savedFiles = files.map(file => ({ ...file }));
            const restore = () => {
                lock = { ...savedLock };
                works.splice(0, works.length, ...savedWorks);
                files.splice(0, files.length, ...savedFiles.map(file => ({ ...file })));
            };
            inTransaction = true;
            try {
                await operation();
                if (options.retryAt) {
                    restore();
                    clock = new Date(options.retryAt);
                    options.retryAt = undefined;
                    await operation();
                }
            } catch (error) { restore(); throw error; }
            finally { inTransaction = false; release(); }
        },
        async endSession() {},
    }) };
    const modules = {
        mongodb: { ObjectId },
        'next/server': { NextResponse: { json: Response.json }, after: () => { notifications++; } },
        '@/lib/auth0-compat': {
            getSession: async () => sessionUser ? { user: sessionUser } : null,
            withApiAuthRequired: (handler: (request: Request) => Promise<Response>) =>
                (request: Request) => sessionUser ? handler(request) : Response.json({}, { status: 401 }),
        },
        '@/lib/mongodb': { connectToDatabase: async () => { connections++; return { db, client }; } },
        '@/lib/payments/config': {
            getActivePaymentConfig: async () => options.paymentConfigMissing ? null : { edicaoId: editionId },
            getEditionId: () => editionId,
        },
        '@/lib/payments/transactions': { runPaymentTransaction },
        '@/lib/remote-work-access': { findRemoteWorkAccess: async () => null, REMOTE_WORK_SUBMISSION_LOCKS_COLLECTION: 'trabalhos_submission_locks' },
        '@/lib/academic-work-files': { ...filesPolicy, workSubmissionIsOpen: (value: typeof config, now = clock) => filesPolicy.workSubmissionIsOpen(value, now) },
        '@/lib/academic-work-submission': submissionPolicy,
        '@/lib/work-receipt-email': { notifyWorkReceipt: () => { throw new Error('Must not send email in tests'); } },
        '@/lib/work-submission-exception': { getWorkSubmissionException: (uid: string, edition: string, value: typeof config, now = clock) =>
            getWorkSubmissionException(uid, edition, value, now) },
    };
    function load(path: string) {
        const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        });
        const exports: Record<string, (req: Request) => Promise<Response>> = {};
        runInNewContext(outputText, {
            exports, Response, process, console,
            Date: class extends Date { constructor(value?: string) { super(value ?? clock.toISOString()); } },
            require: (name: string) => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
        });
        return exports;
    }
    const post = load('../../api/post/submitWork/route.ts').POST;
    const get = load('../../api/get/trabalhosConfig/route.js').GET;
    const request = (overrides: Document = {}) => post(new Request('https://example.test/api/post/submitWork', {
        method: 'POST', body: JSON.stringify({
            clientVersion: 2, titulo: 'Trabalho teste', modalidadeId: modalityId,
            autores: [
                { nome: 'Autor', email: 'author@example.test', cpf: '52998224725' },
                { nome: 'Orientador', email: 'advisor@example.test', isOrientador: true },
            ],
            attachments: [{ slotIndex: 0, fileId }], ...overrides,
        }),
    }));
    return { request, get: () => get(new Request('https://example.test/api/get/trabalhosConfig')),
        works, files, options, get lock() { return lock; }, get notifications() { return notifications; },
        get connections() { return connections; } };
}

test('configuração autenticada libera somente o titular e não expõe o objeto privado', async t => {
    configure(t);
    const h = harness();
    const response = await h.get();
    const body = await response.json();
    assert.equal(body.submissionExceptionExpiresAt, expiresAt);
    assert.equal(body.isOpen, false);
    assert.equal(body.data_limite_submissao, config.data_limite_submissao);
    assert.match(response.headers.get('cache-control')!, /private, no-store/);
    assert.equal(response.headers.get('vary'), 'Cookie');
    assert.equal(JSON.stringify(body).includes(userId), false);
    for (const options of [{ subject: `auth0|${otherUserId}` }, { existingWork: true }, { used: true },
        { now: expiresAt }, { paymentConfigMissing: true }]) {
        assert.equal((await (await harness(options).get()).json()).submissionExceptionExpiresAt, null);
    }
    const anonymous = harness({ subject: null });
    assert.equal((await anonymous.get()).status, 401);
    assert.equal(anonymous.connections, 0);
});

test('API rejeita outra conta mesmo com ID, prazo e liberação forjados no payload', async t => {
    configure(t);
    const h = harness({ subject: `auth0|${otherUserId}` });
    const response = await h.request({ userId, submissionExceptionExpiresAt: expiresAt, submissionException: grant, isOpen: true });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'submission_closed');
    assert.equal(h.works.length, 0);
});

test('primeiro envio consome a autorização junto com trabalho e anexos; exclusão não rearma', async t => {
    configure(t);
    const h = harness();
    assert.equal((await h.request()).status, 200);
    assert.equal(h.works.length, 1);
    assert.equal(h.lock.submissionException.submissionId.toString(), h.works[0]._id.toString());
    assert.equal(h.works[0].submissionException.expiresAt.toISOString(), expiresAt);
    assert.equal(h.files[0].submissionId.toString(), h.works[0]._id.toString());
    assert.equal(h.notifications, 1);
    assert.equal((await (await h.get()).json()).submissionExceptionExpiresAt, null);
    assert.equal((await h.request()).status, 409);
    h.works.splice(0);
    process.env.WORK_SUBMISSION_EXCEPTION = JSON.stringify({ ...grant, activatedAt: '2026-10-13T17:00:00-03:00' });
    assert.equal((await h.request()).status, 409);
});

test('duas requisições concorrentes produzem apenas um envio na simulação transacional', async t => {
    configure(t);
    const h = harness();
    const responses = await Promise.all([h.request(), h.request()]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    assert.equal(h.works.length, 1);
    assert.equal(h.notifications, 1);
});

test('falha ao vincular arquivo desfaz consumo e trabalho, permitindo nova tentativa', async t => {
    configure(t);
    const h = harness({ failFileUpdate: true });
    assert.equal((await h.request()).status, 409);
    assert.equal(h.works.length, 0);
    assert.equal(h.lock.submissionException, undefined);
    assert.equal(h.notifications, 0);
    h.options.failFileUpdate = false;
    assert.equal((await h.request()).status, 200);
});

test('API preserva pagamento, autores, anexos, modalidade remota e primeira submissão', async t => {
    configure(t);
    assert.equal((await harness({ paid: false }).request()).status, 402);
    assert.equal((await harness({ existingWork: true }).request()).status, 409);
    assert.equal((await harness().request({ autores: [{ nome: 'Sem orientador', email: 'a@example.test', cpf: '123' }] })).status, 422);
    assert.equal((await harness().request({ attachments: [] })).status, 422);
    assert.equal((await harness().request({ participationMode: 'REMOTE' })).status, 403);
});

test('vencimento e revogação bloqueiam envio direto e retry revalida a janela', async t => {
    configure(t);
    assert.equal((await harness({ now: expiresAt }).request()).status, 403);
    const h = harness({ retryAt: expiresAt });
    assert.equal((await h.request()).status, 403);
    assert.equal(h.works.length, 0);
    assert.equal(h.lock.submissionException, undefined);
    delete process.env.WORK_SUBMISSION_EXCEPTION;
    assert.equal((await harness().request()).status, 403);
});

test('período regular continua funcionando sem configurar ou consumir exceção', async t => {
    configure(t, '');
    const h = harness({ open: true });
    assert.equal((await h.request()).status, 200);
    assert.equal(h.lock.submissionException, undefined);
    assert.equal(h.works[0].submissionException, undefined);
});
