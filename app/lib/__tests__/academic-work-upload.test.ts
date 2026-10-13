import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import { fileTypeFromBuffer } from 'file-type';
import ts from 'typescript';
import {
    MAX_WORK_UPLOAD_PART_BYTES, workUploadLimits, validateWorkFile, workFileExtension,
} from '../academic-work-files.ts';

const MiB = 1024 * 1024;
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('limita configuração antiga de 10 MiB e preserva valores menores sem mutar a modalidade', () => {
    const config = Object.freeze({ chunk_limite: 10 * MiB, chunk_tamanho: 2.5 * MiB });
    assert.deepEqual(workUploadLimits(config), { chunkThreshold: 4 * MiB, chunkSize: 2.5 * MiB });
    assert.deepEqual(workUploadLimits({ chunk_limite: 10 * MiB, chunk_tamanho: 10 * MiB }),
        { chunkThreshold: 4 * MiB, chunkSize: 4 * MiB });
    assert.deepEqual(workUploadLimits({ chunk_limite: MiB, chunk_tamanho: MiB / 2 }),
        { chunkThreshold: MiB, chunkSize: MiB / 2 });
});

test('configurações ausentes ou inválidas recebem limites seguros', () => {
    const expected = { chunkThreshold: 4 * MiB, chunkSize: 2.5 * MiB };
    assert.deepEqual(workUploadLimits(), expected);
    for (const value of [undefined, null, 0, -1, 1.5, NaN, Infinity, '10485760', {}, Number.MAX_VALUE]) {
        assert.deepEqual(workUploadLimits({ chunk_limite: value, chunk_tamanho: value }), expected);
    }
});

test('4 MiB usa upload simples; acima disso usa partes com multipart abaixo de 4,5 MB', async () => {
    for (const config of [undefined, { chunk_limite: 10 * MiB, chunk_tamanho: 10 * MiB },
        { chunk_limite: 10 * MiB, chunk_tamanho: 2.5 * MiB }]) {
        const { chunkThreshold, chunkSize } = workUploadLimits(config);
        for (const size of [4 * MiB, 4 * MiB + 1, 10 * MiB]) {
            const chunked = size > chunkThreshold;
            assert.equal(chunked, size > 4 * MiB);
            const bytes = new Uint8Array(size);
            const parts = chunked ? Math.ceil(size / chunkSize) : 1;
            const recovered: Buffer[] = [];
            for (let index = 0; index < parts; index++) {
                const part = chunked ? bytes.subarray(index * chunkSize, (index + 1) * chunkSize) : bytes;
                assert.ok(part.length <= MAX_WORK_UPLOAD_PART_BYTES);
                const form = new FormData();
                form.append(chunked ? 'chunk' : 'file', new Blob([part]), 'trabalho.docx');
                if (chunked) {
                    form.append('chunkIndex', String(index));
                    form.append('totalChunks', String(parts));
                    form.append('fileName', randomUUID());
                } else {
                    form.append('originalFileName', 'trabalho.docx');
                    form.append('purpose', 'submission');
                }
                const request = new Request('https://example.test/upload', { method: 'POST', body: form });
                assert.ok((await request.arrayBuffer()).byteLength < 4_500_000);
                recovered.push(Buffer.from(part));
            }
            assert.deepEqual(Buffer.concat(recovered), Buffer.from(bytes));
        }
    }
});

// ZIP armazenado com CRC e diretório central válidos, sem dependência extra.
// Permite colocar os metadados DOCX depois de uma entrada maior que 4,5 MB.
function zip(entries: Array<[string, Buffer]>): Buffer {
    const files: Buffer[] = [];
    const directory: Buffer[] = [];
    let offset = 0;
    for (const [path, bytes] of entries) {
        const name = Buffer.from(path);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc32(bytes), 14);
        local.writeUInt32LE(bytes.length, 18);
        local.writeUInt32LE(bytes.length, 22);
        local.writeUInt16LE(name.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        local.copy(central, 8, 6, 28);
        central.writeUInt32LE(offset, 42);
        files.push(local, name, bytes);
        directory.push(central, name);
        offset += local.length + name.length + bytes.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.reduce((size, part) => size + part.length, 0), 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...files, ...directory, end]);
}

function largeDocx(): Buffer {
    return zip([
        ['padding.bin', Buffer.alloc(6 * MiB, 42)],
        ['_rels/.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')],
        ['word/document.xml', Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Teste</w:t></w:r></w:p></w:body></w:document>')],
        ['[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')],
    ]);
}

type Chunk = { chunkId: string; chunkIndex: number; totalChunks: number; size: number;
    userId: string; fileName: string; url: string };
type HarnessOptions = {
    pieceSize?: number; chunkSize?: number; authenticated?: boolean;
    mutateChunks?: (chunks: Chunk[]) => void;
    bodyForChunk?: (body: Buffer, index: number) => Buffer;
    failRead?: boolean; failPut?: boolean; failInsert?: boolean; failCleanup?: boolean;
};

const source = readFileSync(new URL('../../api/post/reconstructBlobFile/route.js', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

// A rota real executa com autenticação, MongoDB, fetch e Blob simulados.
// Nenhum cliente de banco é carregado, nenhuma requisição externa é feita.
function reconstructionHarness(bytes: Buffer, name: string, options: HarnessOptions = {}) {
    const chunkSize = options.chunkSize ?? 2.5 * MiB;
    const bodies: Buffer[] = [];
    for (let offset = 0; offset < bytes.length; offset += chunkSize) bodies.push(bytes.subarray(offset, offset + chunkSize));
    const chunks: Chunk[] = bodies.map((body, index) => ({ chunkId: `chunk-${index}`, chunkIndex: index,
        totalChunks: bodies.length, size: body.length, userId: 'owner', fileName: 'upload-id', url: `https://blob.test/chunk-${index}` }));
    const chunkIds = chunks.map(chunk => chunk.chunkId);
    options.mutateChunks?.(chunks);
    const inserted: Array<Record<string, any>> = [];
    const puts: Array<{ bytes: Buffer; options: Record<string, unknown> }> = [];
    const deleted: string[] = [];
    const fetched: string[] = [];
    let connections = 0;
    let chunkDeletes = 0;
    let detectedBuffer: Buffer | undefined;
    const db = { collection(collectionName: string) {
        if (collectionName === 'trabalhos_chunks') return {
            find(filter: any) {
                assert.equal(filter.userId, 'owner');
                assert.equal(filter.fileName, 'upload-id');
                return { toArray: async () => chunks.filter(chunk => chunk.userId === filter.userId
                    && chunk.fileName === filter.fileName && filter.chunkId.$in.includes(chunk.chunkId)).reverse() };
            },
            async deleteMany(filter: any) {
                assert.equal(filter.userId, 'owner');
                assert.deepEqual(Array.from(filter.chunkId.$in), chunkIds);
                chunkDeletes++;
            },
        };
        assert.equal(collectionName, 'trabalhos_blob');
        return { async insertOne(file: Record<string, any>) {
            if (options.failInsert) throw new Error('Simulated insert failure');
            inserted.push(file);
            return { insertedId: 'stored-file-id' };
        } };
    } };
    const modules: Record<string, unknown> = {
        'node:crypto': { randomUUID },
        'file-type': { fileTypeFromBuffer: async (buffer: Buffer) => {
            detectedBuffer = buffer;
            return fileTypeFromBuffer(buffer);
        } },
        'next/server': { NextResponse: Response },
        '@/lib/academic-work-files': { validateWorkFile, workFileExtension },
        '@/lib/auth0-compat': {
            getSession: async () => ({ user: { sub: 'auth0|owner' } }),
            withApiAuthRequired: (handler: (request: Request) => Promise<Response>) => (request: Request) =>
                options.authenticated === false ? Response.json({ error: 'unauthorized' }, { status: 401 }) : handler(request),
        },
        '@/lib/mongodb': { connectToDatabase: async () => { connections++; return { db }; } },
        '@vercel/blob': {
            put: async (pathname: string, buffer: Buffer, putOptions: Record<string, unknown>) => {
                if (options.failPut) throw new Error('Simulated Blob failure');
                assert.equal(buffer, detectedBuffer, 'Blob deve receber o mesmo buffer validado');
                puts.push({ bytes: buffer, options: putOptions });
                return { pathname, url: 'https://blob.test/final' };
            },
            del: async (urls: string | string[]) => {
                if (options.failCleanup && Array.isArray(urls)) throw new Error('Simulated cleanup failure');
                deleted.push(...(Array.isArray(urls) ? urls : [urls]));
            },
        },
    };
    const exports: { POST?: (request: Request) => Promise<Response> } = {};
    runInNewContext(outputText, {
        exports, Buffer, console: { error() {} },
        require: (dependency: string) => {
            assert.ok(dependency in modules, `Unexpected dependency: ${dependency}`);
            return modules[dependency];
        },
        fetch: async (url: string) => {
            fetched.push(url);
            if (options.failRead) return { ok: false };
            const index = bodies.findIndex((_body, index) => url === `https://blob.test/chunk-${index}`);
            assert.ok(index >= 0);
            const body = options.bodyForChunk?.(bodies[index], index) ?? bodies[index];
            return { ok: true, body: (async function* () {
                const pieceSize = options.pieceSize ?? 4096;
                for (let offset = 0; offset < body.length; offset += pieceSize) yield body.subarray(offset, offset + pieceSize);
            })() };
        },
    });
    return {
        inserted, puts, deleted, fetched, connections: () => connections, chunkDeletes: () => chunkDeletes,
        request: (overrides: Record<string, unknown> = {}) => exports.POST!(new Request('https://example.test/reconstruct', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
                chunkFileName: 'upload-id', finalFileName: name, originalName: name,
                totalSize: bytes.length, chunkIds, purpose: 'submission', ...overrides,
            }),
        })),
    };
}

for (const name of ['modelo-artigo-original-i-cieps.docx', 'modelo-resumo-simples-i-cieps.docx']) {
    for (const pieceSize of [4096, 16384, 65536]) {
        test(`reconstrói ${name} com fragmentos de rede de ${pieceSize} bytes`, async () => {
            const bytes = readFileSync(new URL(`../../../public/modelos/${name}`, import.meta.url));
            const harness = reconstructionHarness(bytes, name, { pieceSize, chunkSize: 32768 });
            const response = await harness.request();
            assert.equal(response.status, 200);
            const result = await response.json();
            assert.equal(result.data._id, 'stored-file-id');
            assert.equal(result.data.size, bytes.length);
            assert.ok(Number.isFinite(Date.parse(result.data.uploadDate)));
            assert.equal(harness.inserted[0].contentType, docxMime);
            assert.equal(harness.inserted[0].purpose, 'submission');
            assert.equal(harness.inserted[0].userId, 'owner');
            assert.equal(harness.inserted[0].chunked, true);
            assert.deepEqual(harness.puts[0].bytes, bytes);
            assert.equal(harness.puts[0].options.multipart, true);
            assert.equal(harness.chunkDeletes(), 1);
            assert.deepEqual(harness.deleted, harness.fetched);
        });
    }
}

test('DOCX de mais de 6 MiB com metadados no fim mantém hash e MIME após reconstrução', async () => {
    const bytes = largeDocx();
    assert.ok(bytes.length > 6 * MiB);
    assert.equal((await fileTypeFromBuffer(bytes))?.mime, docxMime);
    const harness = reconstructionHarness(bytes, 'grande.docx');
    assert.equal((await harness.request()).status, 200);
    assert.equal(harness.fetched.length, 3);
    assert.equal(createHash('sha256').update(harness.puts[0].bytes).digest('hex'),
        createHash('sha256').update(bytes).digest('hex'));
    assert.equal(harness.inserted[0].contentType, docxMime);
});

const pdf = readFileSync(new URL('../../../public/modelos/modelo-resumo-simples-i-cieps.pdf', import.meta.url));

test('PDF e contrato legado de correção continuam aceitos', async () => {
    const harness = reconstructionHarness(pdf, 'correcao.pdf');
    const response = await harness.request({ purpose: undefined, originalName: undefined });
    assert.equal(response.status, 200);
    assert.equal(harness.inserted[0].purpose, 'correction');
    assert.equal(harness.inserted[0].contentType, 'application/pdf');
    assert.deepEqual(harness.puts[0].bytes, pdf);
});

test('ZIP comum e PDF renomeados como DOCX são recusados sem criar Blob final', async () => {
    for (const bytes of [zip([['texto.txt', Buffer.from('arquivo comum')]]), pdf]) {
        const harness = reconstructionHarness(bytes, 'falso.docx');
        assert.equal((await harness.request()).status, 415);
        assert.equal(harness.puts.length, 0);
        assert.equal(harness.inserted.length, 0);
        assert.equal(harness.deleted.length, 0);
    }
});

test('bloqueia requisição sem autenticação antes de consultar as partes', async () => {
    const harness = reconstructionHarness(pdf, 'arquivo.pdf', { authenticated: false });
    assert.equal((await harness.request()).status, 401);
    assert.equal(harness.connections(), 0);
});

test('preserva teto de 100 MiB e rejeita IDs repetidos antes de alocar ou consultar', async () => {
    for (const overrides of [{ totalSize: 100 * MiB + 1 }, { totalSize: 0 }, { chunkIds: ['chunk-0', 'chunk-0'] }]) {
        const harness = reconstructionHarness(pdf, 'arquivo.pdf');
        assert.equal((await harness.request(overrides)).status, 400);
        assert.equal(harness.connections(), 0);
        assert.equal(harness.fetched.length, 0);
    }
});

for (const [label, mutateChunks] of [
    ['parte ausente', (chunks: Chunk[]) => { chunks.pop(); }],
    ['outro dono', (chunks: Chunk[]) => { chunks[0].userId = 'another-owner'; }],
    ['outro upload', (chunks: Chunk[]) => { chunks[0].fileName = 'another-upload'; }],
    ['índice incorreto', (chunks: Chunk[]) => { chunks[0].chunkIndex = 1; }],
    ['quantidade incorreta', (chunks: Chunk[]) => { chunks[0].totalChunks++; }],
    ['tamanho incorreto', (chunks: Chunk[]) => { chunks[0].size++; }],
] as const) {
    test(`recusa ${label} antes de baixar partes`, async () => {
        const harness = reconstructionHarness(pdf, 'arquivo.pdf', { mutateChunks });
        assert.equal((await harness.request()).status, 400);
        assert.equal(harness.fetched.length, 0);
        assert.equal(harness.puts.length, 0);
    });
}

for (const [label, bodyForChunk] of [
    ['parte truncada', (body: Buffer) => body.subarray(0, body.length - 1)],
    ['parte maior que o declarado', (body: Buffer) => Buffer.concat([body, Buffer.from([0])])],
] as const) {
    test(`recusa ${label} antes de identificar ou publicar arquivo`, async () => {
        const harness = reconstructionHarness(pdf, 'arquivo.pdf', { bodyForChunk });
        assert.equal((await harness.request()).status, 500);
        assert.equal(harness.puts.length, 0);
        assert.equal(harness.inserted.length, 0);
        assert.equal(harness.deleted.length, 0);
    });
}

test('falhas na leitura e no Blob não registram arquivo concluído', async () => {
    for (const options of [{ failRead: true }, { failPut: true }]) {
        const harness = reconstructionHarness(pdf, 'arquivo.pdf', options);
        assert.equal((await harness.request()).status, 500);
        assert.equal(harness.inserted.length, 0);
        assert.equal(harness.chunkDeletes(), 0);
    }
});

test('falha ao registrar arquivo remove Blob final; falha de limpeza não desfaz sucesso', async () => {
    const failed = reconstructionHarness(pdf, 'arquivo.pdf', { failInsert: true });
    assert.equal((await failed.request()).status, 500);
    assert.deepEqual(failed.deleted, ['https://blob.test/final']);
    assert.equal(failed.chunkDeletes(), 0);
    const success = reconstructionHarness(pdf, 'arquivo.pdf', { failCleanup: true });
    assert.equal((await success.request()).status, 200);
    assert.equal(success.inserted.length, 1);
    assert.equal(success.deleted.length, 0);
});
