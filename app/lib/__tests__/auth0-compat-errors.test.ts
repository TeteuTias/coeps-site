import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Carrega o auth0-compat real com uma sessão em memória: não fala com o Auth0.
function loadCompat() {
    const client = { getSession: async () => ({ user: { sub: 'auth0|507f1f77bcf86cd799439011' } }) };
    const source = readFileSync(new URL('../auth0-compat.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports: Record<string, any> = {};
    runInNewContext(outputText, {
        exports, Response,
        require: (name: string) => {
            assert.equal(name, './auth0');
            return { auth0: client, getAuth0Client: () => client };
        },
    });
    return exports;
}

const request = () => new Request('http://localhost/api/payment/createActivityPayment', { method: 'POST' });

test('erro 500 marcado como público chega ao participante com a mensagem da rota', async () => {
    const { withApiAuthRequired, publicErrorResponse } = loadCompat();
    const route = withApiAuthRequired(async () => publicErrorResponse('Não foi possível gerar o PIX agora e sua vaga não foi reservada.'));
    const response = await route(request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
        error: 'internal_server_error',
        message: 'Não foi possível gerar o PIX agora e sua vaga não foi reservada.',
    });
    assert.equal(response.headers.get('x-public-error-message'), null);
});

test('erro 500 comum continua com o texto genérico (não vaza detalhe interno)', async () => {
    const { withApiAuthRequired } = loadCompat();
    for (const body of [{ message: 'detalhe interno [stack]' }, { error: { code: 11000 } }]) {
        const route = withApiAuthRequired(async () => Response.json(body, { status: 500 }));
        const response = await route(request());
        assert.equal(response.status, 500);
        assert.equal((await response.json()).message, 'Não foi possível concluir a solicitação.');
    }
});

test('erro público sem mensagem cai no texto genérico', async () => {
    const { withApiAuthRequired } = loadCompat();
    const route = withApiAuthRequired(async () => new Response('x', { status: 500, headers: { 'x-public-error-message': '1' } }));
    const response = await route(request());
    assert.equal((await response.json()).message, 'Não foi possível concluir a solicitação.');
});
