import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Executa a rota pública real com coleções em memória: não abre conexão com MongoDB.
test('programação pública não devolve os ids dos inscritos e mantém as vagas', async () => {
    const minicurso = {
        _id: 'm1', name: 'APH Tático (TURMA 1)', showToUser: true, maxParticipants: 20,
        participantsCount: 1, participants: ['6aa000000000000000000001'],
    };
    const finds: Record<string, unknown[]> = {};
    const collection = (name: string) => ({
        find: (filter: unknown, options?: { projection?: Record<string, 0 | 1> }) => {
            finds[name] = [filter, options];
            const docs = name === 'minicursos' ? [minicurso] : [];
            const hidden = Object.entries(options?.projection ?? {}).filter(([, value]) => value === 0).map(([key]) => key);
            return {
                toArray: async () => docs.map((doc) => Object.fromEntries(
                    Object.entries(doc).filter(([key]) => !hidden.includes(key)),
                )),
            };
        },
    });
    const modules: Record<string, unknown> = {
        '@/app/lib/mongodb': { connectToDatabase: async () => ({ db: { collection } }) },
        'next/server': { NextResponse: { json: Response.json } },
    };
    const source = readFileSync(new URL('../../api/inauthenticated/get/programacao/route.js', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
    });
    const exports: Record<string, (request: Request, context: unknown) => Promise<Response>> = {};
    runInNewContext(outputText, {
        exports, Response,
        require: (name: string) => {
            assert.ok(name in modules, `Unexpected dependency: ${name}`);
            return modules[name];
        },
    });
    const response = await exports.GET(new Request('http://localhost/api/inauthenticated/get/programacao'), { params: {} });
    assert.equal(response.status, 200);
    const { result2 } = await response.json();
    assert.equal(result2.length, 1);
    assert.equal('participants' in result2[0], false);
    assert.equal(result2[0].maxParticipants, 20);
    assert.equal(result2[0].participantsCount, 1);
    assert.equal(JSON.stringify(finds.minicursos[1]), JSON.stringify({ projection: { participants: 0 } }));
});
