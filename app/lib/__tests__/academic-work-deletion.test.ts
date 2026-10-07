import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ObjectId, type Document } from 'mongodb';
import ts from 'typescript';
import { workSubmissionIsOpen } from '../academic-work-files.ts';
import { runPaymentTransaction } from '../payments/transactions.ts';

const ownerId = '507f1f77bcf86cd799439011';
const otherOwnerId = '507f1f77bcf86cd799439012';
const workId = '507f1f77bcf86cd799439013';
const otherWorkId = '507f1f77bcf86cd799439014';
const fileId = '507f1f77bcf86cd799439015';
const now = new Date('2026-10-07T15:00:00-03:00');
const openConfig = {
    isOpen: true,
    data_inicio_submissao: '2026-10-07T14:59:00-03:00',
    data_limite_submissao: '2026-10-07T15:01:00-03:00',
};

// Executa a rota real com dependências em memória: não cria MongoClient,
// não conecta a MongoDB/Auth0 e não chama o serviço Vercel Blob.
function deletionHarness(options: {
    subject?: unknown;
    config?: Document | null;
    works?: Document[];
    files?: Document[];
    blobFailure?: boolean;
    databaseFailure?: boolean;
    deleteCount?: number;
    failBlobAt?: number;
    failCommit?: boolean;
    failJobInsert?: boolean;
    failCleanupUpdate?: boolean;
    retryWithCorrection?: boolean;
    deleteBeforeCorrectionWrite?: boolean;
} = {}) {
    const works = options.works ?? [{ _id: new ObjectId(workId), userId: new ObjectId(ownerId), titulo: 'Trabalho teste', status: 'Necessita de Alteração', arquivos: [] }];
    const files = options.files ?? [];
    const jobs: Document[] = [];
    const collections: string[] = [];
    const removedUrls: string[] = [];
    let connections = 0;
    let workDeletes = 0;
    let fileDeletes = 0;
    let blobCalls = 0;
    let inTransaction = false;
    const checkSession = (queryOptions?: Document) => assert.equal(Boolean(queryOptions?.session), inTransaction);
    const clone = (documents: Document[]) => documents.map(doc => ({ ...doc,
        ...(doc.arquivos ? { arquivos: doc.arquivos.map(file => file && ({ ...file })) } : {}),
        ...(doc.pendingUrls ? { pendingUrls: [...doc.pendingUrls] } : {}),
    }));
    const matchesOwner = (document: Document, filter: Document) =>
        document._id.equals(filter._id) && document.userId.equals(filter.userId);
    const matchesFile = (document: Document, filter: Document) => {
        assert.equal(typeof filter.userId, 'string');
        assert.ok(filter._id.$in.every((id: unknown) => id instanceof ObjectId));
        assert.equal(filter.$or[0].submissionId.toHexString(), workId);
        assert.equal(filter.$or[1].submissionId.$exists, false);
        return document.userId === filter.userId &&
            filter._id.$in.some((id: ObjectId) => document._id.equals(id)) &&
            (document.submissionId === undefined || document.submissionId.equals(filter.$or[0].submissionId));
    };
    const db = {
        collection(name: string) {
            collections.push(name);
            if (name === 'Dados_do_trabalho') return {
                async findOne(filter: Document, queryOptions?: Document) {
                    checkSession(queryOptions);
                    assert.ok(filter._id instanceof ObjectId);
                    assert.ok(filter.userId instanceof ObjectId);
                    return clone(works.filter(work => matchesOwner(work, filter)))[0] ?? null;
                },
                find(filter: Document, queryOptions?: Document) {
                    checkSession(queryOptions);
                    return { toArray: async () => clone(works.filter(work => work.userId.equals(filter.userId))) };
                },
                async updateOne(filter: Document, update: Document) {
                    if (options.deleteBeforeCorrectionWrite) await request();
                    const work = works.find(work => matchesOwner(work, filter) && work.status === filter.status);
                    if (!work) return { matchedCount: 0 };
                    Object.assign(work, update.$set);
                    work.arquivos.push(...update.$push.arquivos.$each);
                    return { matchedCount: 1 };
                },
                async deleteOne(filter: Document, queryOptions?: Document) {
                    checkSession(queryOptions);
                    workDeletes += 1;
                    const index = works.findIndex(work => matchesOwner(work, filter));
                    if (options.deleteCount === 0 || index < 0) return { deletedCount: 0 };
                    works.splice(index, 1);
                    return { deletedCount: 1 };
                },
            };
            if (name === 'trabalhos_config') return {
                async findOne(_filter: Document, queryOptions?: Document) { checkSession(queryOptions); return options.config === undefined ? openConfig : options.config; },
            };
            if (name === 'trabalhos_blob') return {
                find(filter: Document, queryOptions?: Document) {
                    checkSession(queryOptions);
                    return { toArray: async () => files.filter(file => matchesFile(file, filter)) };
                },
                async deleteMany(filter: Document, queryOptions?: Document) {
                    checkSession(queryOptions);
                    fileDeletes += 1;
                    for (let index = files.length - 1; index >= 0; index -= 1) {
                        if (matchesFile(files[index], filter)) files.splice(index, 1);
                    }
                },
            };
            if (name === 'trabalhos_exclusoes') return {
                async findOne(filter: Document, queryOptions?: Document) { checkSession(queryOptions); return clone(jobs.filter(job => matchesOwner(job, filter)))[0] ?? null; },
                find(filter: Document, projection: Document) {
                    checkSession(projection);
                    assert.deepEqual(JSON.parse(JSON.stringify(projection.projection)), { _id: 1, titulo: 1 });
                    return { toArray: async () => jobs.filter(job => job.userId.equals(filter.userId) && job.status === filter.status)
                        .map(job => ({ _id: job._id, titulo: job.titulo })) };
                },
                async insertOne(job: Document, queryOptions?: Document) {
                    checkSession(queryOptions);
                    if (options.failJobInsert) throw new Error('Job write unavailable');
                    jobs.push(...clone([job]));
                },
                async updateOne(filter: Document, update: Document) {
                    if (options.failCleanupUpdate) throw new Error('Job update unavailable');
                    const job = jobs.find(job => matchesOwner(job, filter) && (!filter.pendingUrls || job.pendingUrls.length === filter.pendingUrls.$size));
                    if (!job) return { matchedCount: 0 };
                    if (update.$pull) job.pendingUrls = job.pendingUrls.filter(url => url !== update.$pull.pendingUrls);
                    if (update.$set) Object.assign(job, update.$set);
                    return { matchedCount: 1 };
                },
            };
            throw new Error(`Unexpected collection: ${name}`);
        },
    };
    // Modelo de rollback/retry do driver; não é um servidor MongoDB em memória.
    const client = { startSession: () => ({
        async withTransaction(operation: () => Promise<void>) {
            const snapshot = [clone(works), clone(files), clone(jobs)];
            const restore = () => [works, files, jobs].forEach((docs, index) => docs.splice(0, docs.length, ...clone(snapshot[index])));
            inTransaction = true;
            try {
                await operation();
                if (options.retryWithCorrection) {
                    options.retryWithCorrection = false;
                    restore();
                    inTransaction = false;
                    assert.equal((await correct()).status, 200);
                    inTransaction = true;
                    await operation();
                }
                if (options.failCommit) throw new Error('Commit failed');
            } catch (error) { restore(); throw error; }
            finally { inTransaction = false; }
        },
        async endSession() {},
    }) };
    const modules = {
        mongodb: { ObjectId },
        bson: { ObjectId },
        'next/server': { NextResponse: { json: Response.json } },
        '@/lib/auth0-compat': {
            withApiAuthRequired: (handler: unknown) => handler,
            getSession: async () => ({ user: { sub: options.subject === undefined ? `auth0|${ownerId}` : options.subject } }),
        },
        '@/lib/mongodb': { connectToDatabase: async () => {
            connections += 1;
            if (options.databaseFailure) throw new Error('Database unavailable');
            return { db, client };
        } },
        '@/app/lib/mongodb': { connectToDatabase: async () => ({ db, client }) },
        '../../../lib/mongodb': { connectToDatabase: async () => ({ db, client }) },
        '@/lib/payments/transactions': { runPaymentTransaction },
        '@vercel/blob': { del: async (url: string) => {
            assert.equal(inTransaction, false, 'Blob must only be deleted after commit');
            blobCalls += 1;
            if (options.blobFailure || blobCalls === options.failBlobAt) throw new Error('Blob unavailable');
            removedUrls.push(url);
        } },
        '@/lib/academic-work-files': {
            workSubmissionIsOpen: (config: Document) => workSubmissionIsOpen(config, now),
        },
    };
    const loadRoute = (path: string) => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    runInNewContext(outputText, {
        exports, Response, AbortSignal,
        require: (name: string) => {
            assert.ok(name in modules, `Unexpected dependency: ${name}`);
            return modules[name];
        },
    });
    return exports;
    };
    const exports = loadRoute('../../api/delete/trabalho/route.js');
    const request = (body: unknown = { trabalhoId: workId }, raw = false) => exports.DELETE(new Request('https://example.test/api/delete/trabalho', {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: raw ? String(body) : JSON.stringify(body),
    }));
    const correct = () => {
        const file = { _id: new ObjectId(), userId: ownerId, url: 'https://blob.test/correction' };
        files.push(file);
        return loadRoute('../../api/put/academicWork/route.ts').PUT(new Request('https://example.test/api/put/academicWork', {
            method: 'PUT', body: JSON.stringify({ academicWork: { _id: workId, userId: ownerId, topicos: {} },
                newFiles: [{ fileId: String(file._id), url: file.url }] }),
        }));
    };
    const list = () => loadRoute('../../api/get/usuariosTrabalhos/route.js').GET(new Request('https://example.test/api/get/usuariosTrabalhos'));
    return { request, correct, list, works, files, jobs, removedUrls, collections,
        connections: () => connections, workDeletes: () => workDeletes, fileDeletes: () => fileDeletes };
}

test('dono exclui a submissão mesmo sem userId no array de autores', async () => {
    const harness = deletionHarness();
    const response = await harness.request();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).cleanupPending, false);
    assert.equal(harness.works.length, 0);
    assert.equal(harness.connections(), 1);
    assert.equal(harness.workDeletes(), 1);
});

test('somente o dono pode excluir; autor vinculado não equivale a proprietário', async () => {
    const harness = deletionHarness({ works: [{ _id: new ObjectId(workId), userId: new ObjectId(otherOwnerId),
        autores: [{ userId: new ObjectId(ownerId) }], arquivos: [] }] });
    assert.equal((await harness.request()).status, 404);
    assert.equal(harness.works.length, 1);
    assert.equal(harness.workDeletes(), 0);
    assert.equal(harness.fileDeletes(), 0);
    assert.equal(harness.removedUrls.length, 0);
});

test('trabalho inexistente retorna 404 sem remover arquivos', async () => {
    const harness = deletionHarness({ works: [] });
    assert.equal((await harness.request()).status, 404);
    assert.equal(harness.workDeletes(), 0);
    assert.equal(harness.fileDeletes(), 0);
});

test('JSON e identificadores inválidos retornam 400 antes da conexão', async () => {
    for (const body of [null, {}, { trabalhoId: '' }, { trabalhoId: 'invalid' }, { trabalhoId: 123 },
        { trabalhoId: { $ne: null } }, { trabalhoId: ['507f1f77bcf86cd799439013'] }]) {
        const harness = deletionHarness();
        assert.equal((await harness.request(body)).status, 400);
        assert.equal(harness.connections(), 0);
    }
    const harness = deletionHarness();
    assert.equal((await harness.request('{invalid', true)).status, 400);
    assert.equal(harness.connections(), 0);
});

test('sessão inválida retorna 401 antes da conexão', async () => {
    for (const subject of [null, '', {}, 'auth0|invalid', ownerId, `google-oauth2|${ownerId}`]) {
        const harness = deletionHarness({ subject });
        assert.equal((await harness.request()).status, 401);
        assert.equal(harness.connections(), 0);
    }
});

test('normaliza anexos e preserva arquivos de outro dono ou outra submissão', async () => {
    const legacyId = new ObjectId();
    const unreferencedId = new ObjectId();
    const foreignId = new ObjectId();
    const reusedId = new ObjectId();
    const harness = deletionHarness({
        works: [{ _id: new ObjectId(workId), userId: new ObjectId(ownerId), arquivos: [
            { fileId }, { fileId: legacyId }, { fileId: foreignId.toHexString() }, { fileId: reusedId },
            { fileId: 'invalid' }, null,
        ] }],
        files: [
            { _id: new ObjectId(fileId), userId: ownerId, submissionId: new ObjectId(workId), url: 'https://blob.test/current' },
            { _id: legacyId, userId: ownerId, url: 'https://blob.test/legacy' },
            { _id: foreignId, userId: otherOwnerId, url: 'https://blob.test/foreign' },
            { _id: reusedId, userId: ownerId, submissionId: new ObjectId(otherWorkId), url: 'https://blob.test/other-work' },
            { _id: unreferencedId, userId: ownerId, url: 'https://blob.test/pending' },
        ],
    });
    assert.equal((await harness.request()).status, 200);
    assert.deepEqual(harness.removedUrls, ['https://blob.test/current', 'https://blob.test/legacy']);
    assert.deepEqual(harness.files.map(file => file._id.toHexString()),
        [foreignId, reusedId, unreferencedId].map(id => id.toHexString()));
});

test('período fechado, futuro ou inválido preserva submissão e anexos', async () => {
    for (const config of [
        { ...openConfig, isOpen: false },
        { ...openConfig, data_inicio_submissao: '2026-10-07T15:00:01-03:00' },
        { ...openConfig, data_limite_submissao: '2026-10-07T14:59:59-03:00' },
        { ...openConfig, data_limite_submissao: 'invalid' },
    ]) {
        const harness = deletionHarness({ config });
        assert.equal((await harness.request()).status, 409);
        assert.equal(harness.works.length, 1);
        assert.equal(harness.workDeletes(), 0);
        assert.equal(harness.fileDeletes(), 0);
        assert.equal(harness.removedUrls.length, 0);
    }
});

test('início e fim exatos respeitam o timestamp com fuso, sem subtrair horas', async () => {
    for (const config of [
        { ...openConfig, data_inicio_submissao: now.toISOString() },
        { ...openConfig, data_limite_submissao: now.toISOString() },
    ]) {
        assert.equal((await deletionHarness({ config }).request()).status, 200);
    }
});

test('configuração ausente ou banco indisponível retorna falha sem exclusões', async () => {
    for (const options of [{ config: null }, { databaseFailure: true }]) {
        const harness = deletionHarness(options);
        assert.equal((await harness.request()).status, 500);
        assert.equal(harness.workDeletes(), 0);
        assert.equal(harness.fileDeletes(), 0);
    }
});

test('falha no Blob exclui o trabalho e preserva o job para nova tentativa', async () => {
    const harness = deletionHarness({ blobFailure: true,
        works: [{ _id: new ObjectId(workId), userId: new ObjectId(ownerId), arquivos: [{ fileId }] }],
        files: [{ _id: new ObjectId(fileId), userId: ownerId, url: 'https://blob.test/current' }],
    });
    const response = await harness.request();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).cleanupPending, true);
    assert.equal(harness.works.length, 0);
    assert.equal(harness.files.length, 0);
    assert.equal(harness.jobs[0].status, 'PENDING');
    assert.deepEqual(harness.jobs[0].pendingUrls, ['https://blob.test/current']);
});

test('deleteOne sem confirmação não retorna falso sucesso', async () => {
    const harness = deletionHarness({ deleteCount: 0 });
    assert.equal((await harness.request()).status, 500);
    assert.equal(harness.works.length, 1);
});

function twoFiles() {
    const files = [new ObjectId(), new ObjectId()].map((id, index) => ({
        _id: id, userId: ownerId, submissionId: new ObjectId(workId), url: `https://blob.test/${index}`,
    }));
    const works = [{ _id: new ObjectId(workId), userId: new ObjectId(ownerId), titulo: 'Teste',
        status: 'Necessita de Alteração', arquivos: files.map(file => ({ fileId: file._id })) }];
    return { files, works };
}

test('falha no segundo Blob deixa só o URL pendente e nunca mantém trabalho ativo com links quebrados', async () => {
    const harness = deletionHarness({ ...twoFiles(), failBlobAt: 2 });
    const first = await harness.request();
    assert.equal(first.status, 200);
    assert.equal((await first.json()).cleanupPending, true);
    assert.equal(harness.works.length, 0);
    assert.equal(harness.files.length, 0);
    assert.deepEqual(harness.jobs[0].pendingUrls, ['https://blob.test/1']);
    assert.deepEqual(harness.removedUrls, ['https://blob.test/0']);
    const second = await harness.request();
    assert.equal((await second.json()).cleanupPending, false);
    assert.deepEqual(harness.removedUrls, ['https://blob.test/0', 'https://blob.test/1']);
    assert.equal(harness.jobs[0].status, 'COMPLETE');
    assert.equal(harness.workDeletes(), 1);
});

test('falha na gravação do job, exclusão final ou commit reverte tudo antes de tocar no Blob', async () => {
    for (const failure of [{ failJobInsert: true }, { deleteCount: 0 }, { failCommit: true }]) {
        const harness = deletionHarness({ ...twoFiles(), ...failure });
        assert.equal((await harness.request()).status, 500);
        assert.equal(harness.works.length, 1);
        assert.equal(harness.files.length, 2);
        assert.equal(harness.jobs.length, 0);
        assert.equal(harness.removedUrls.length, 0);
    }
});

test('limpeza continua após o prazo e repetição após conclusão é idempotente', async () => {
    const options = { ...twoFiles(), blobFailure: true, config: { ...openConfig } };
    const harness = deletionHarness(options);
    assert.equal((await (await harness.request()).json()).cleanupPending, true);
    options.blobFailure = false;
    options.config.isOpen = false;
    assert.equal((await (await harness.request()).json()).cleanupPending, false);
    const deletes = harness.removedUrls.length;
    assert.equal((await (await harness.request()).json()).cleanupPending, false);
    assert.equal(harness.removedUrls.length, deletes);
    assert.equal(harness.workDeletes(), 1);
});

test('falha ao confirmar limpeza mantém URLs recuperáveis mesmo após Blob já removido', async () => {
    const options = { ...twoFiles(), failCleanupUpdate: true };
    const harness = deletionHarness(options);
    assert.equal((await (await harness.request()).json()).cleanupPending, true);
    assert.equal(harness.works.length, 0);
    assert.equal(harness.jobs[0].pendingUrls.length, 2);
    options.failCleanupUpdate = false;
    assert.equal((await (await harness.request()).json()).cleanupPending, false);
    assert.equal(harness.jobs[0].pendingUrls.length, 0);
});

test('retry de transação após correção concorrente captura também os novos anexos', async () => {
    const harness = deletionHarness({ ...twoFiles(), retryWithCorrection: true });
    assert.equal((await (await harness.request()).json()).cleanupPending, false);
    assert.equal(harness.works.length, 0);
    assert.equal(harness.files.length, 0);
    assert.equal(harness.jobs.length, 1);
    assert.deepEqual(harness.removedUrls, ['https://blob.test/0', 'https://blob.test/1', 'https://blob.test/correction']);
});

test('correção que leu o trabalho antes da exclusão retorna 409 quando a gravação perde a disputa', async () => {
    const harness = deletionHarness({ ...twoFiles(), deleteBeforeCorrectionWrite: true });
    const response = await harness.correct();
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'work_changed');
    assert.equal(harness.works.length, 0);
    // O upload não anexado continua disponível; a correção não informou falso sucesso.
    assert.equal(harness.files.length, 1);
    assert.equal(harness.files[0].url, 'https://blob.test/correction');
});

test('listagem expõe somente ID e título dos jobs pendentes do dono', async () => {
    const harness = deletionHarness({ ...twoFiles(), blobFailure: true });
    await harness.request();
    harness.jobs.push({ _id: new ObjectId(), userId: new ObjectId(otherOwnerId), status: 'PENDING', titulo: 'Outro dono' });
    const response = await harness.list();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.pendingDeletions, [{ _id: workId, titulo: 'Teste' }]);
});

test('outro dono não consegue retomar a limpeza de uma exclusão', async () => {
    const options = { ...twoFiles(), blobFailure: true, subject: `auth0|${ownerId}` };
    const harness = deletionHarness(options);
    await harness.request();
    options.blobFailure = false;
    options.subject = `auth0|${otherOwnerId}`;
    assert.equal((await harness.request()).status, 404);
    assert.equal(harness.removedUrls.length, 0);
    assert.equal(harness.jobs[0].pendingUrls.length, 2);
});

test('retomadas concorrentes não repõem URLs já removidos da fila', async () => {
    const options = { ...twoFiles(), blobFailure: true };
    const harness = deletionHarness(options);
    await harness.request();
    options.blobFailure = false;
    const responses = await Promise.all([harness.request(), harness.request()]);
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(harness.jobs[0].pendingUrls.length, 0);
    assert.equal(harness.jobs[0].status, 'COMPLETE');
});
