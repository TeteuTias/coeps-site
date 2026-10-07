import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ObjectId, type Document } from 'mongodb';
import ts from 'typescript';
import { workSubmissionIsOpen } from '../academic-work-files.ts';

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
} = {}) {
    const works = options.works ?? [{ _id: new ObjectId(workId), userId: new ObjectId(ownerId), arquivos: [] }];
    const files = options.files ?? [];
    const collections: string[] = [];
    const removedUrls: string[] = [];
    let connections = 0;
    let workDeletes = 0;
    let fileDeletes = 0;
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
                async findOne(filter: Document) {
                    assert.ok(filter._id instanceof ObjectId);
                    assert.ok(filter.userId instanceof ObjectId);
                    return works.find(work => matchesOwner(work, filter)) ?? null;
                },
                async deleteOne(filter: Document) {
                    workDeletes += 1;
                    const index = works.findIndex(work => matchesOwner(work, filter));
                    if (options.deleteCount === 0 || index < 0) return { deletedCount: 0 };
                    works.splice(index, 1);
                    return { deletedCount: 1 };
                },
            };
            if (name === 'trabalhos_config') return {
                async findOne() { return options.config === undefined ? openConfig : options.config; },
            };
            if (name === 'trabalhos_blob') return {
                find(filter: Document) {
                    return { toArray: async () => files.filter(file => matchesFile(file, filter)) };
                },
                async deleteMany(filter: Document) {
                    fileDeletes += 1;
                    for (let index = files.length - 1; index >= 0; index -= 1) {
                        if (matchesFile(files[index], filter)) files.splice(index, 1);
                    }
                },
            };
            throw new Error(`Unexpected collection: ${name}`);
        },
    };
    const modules = {
        mongodb: { ObjectId },
        '@/lib/auth0-compat': {
            withApiAuthRequired: (handler: unknown) => handler,
            getSession: async () => ({ user: { sub: options.subject === undefined ? `auth0|${ownerId}` : options.subject } }),
        },
        '@/lib/mongodb': { connectToDatabase: async () => {
            connections += 1;
            if (options.databaseFailure) throw new Error('Database unavailable');
            return { db };
        } },
        '@vercel/blob': { del: async (url: string) => {
            if (options.blobFailure) throw new Error('Blob unavailable');
            removedUrls.push(url);
        } },
        '@/lib/academic-work-files': {
            workSubmissionIsOpen: (config: Document) => workSubmissionIsOpen(config, now),
        },
    };
    const source = readFileSync(new URL('../../api/delete/trabalho/route.js', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports: { DELETE?: (request: Request) => Promise<Response> } = {};
    runInNewContext(outputText, {
        exports, Response,
        require: (name: string) => {
            assert.ok(name in modules, `Unexpected dependency: ${name}`);
            return modules[name];
        },
    });
    const request = (body: unknown = { trabalhoId: workId }, raw = false) => exports.DELETE(new Request('https://example.test/api/delete/trabalho', {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: raw ? String(body) : JSON.stringify(body),
    }));
    return { request, works, files, removedUrls, collections,
        connections: () => connections, workDeletes: () => workDeletes, fileDeletes: () => fileDeletes };
}

test('dono exclui a submissão mesmo sem userId no array de autores', async () => {
    const harness = deletionHarness();
    const response = await harness.request();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'Trabalho excluído com sucesso!');
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

test('falha no Blob preserva os registros para nova tentativa', async () => {
    const harness = deletionHarness({ blobFailure: true,
        works: [{ _id: new ObjectId(workId), userId: new ObjectId(ownerId), arquivos: [{ fileId }] }],
        files: [{ _id: new ObjectId(fileId), userId: ownerId, url: 'https://blob.test/current' }],
    });
    assert.equal((await harness.request()).status, 500);
    assert.equal(harness.works.length, 1);
    assert.equal(harness.files.length, 1);
    assert.equal(harness.workDeletes(), 0);
    assert.equal(harness.fileDeletes(), 0);
});

test('deleteOne sem confirmação não retorna falso sucesso', async () => {
    const harness = deletionHarness({ deleteCount: 0 });
    assert.equal((await harness.request()).status, 500);
    assert.equal(harness.works.length, 1);
});
