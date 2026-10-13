import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ObjectId, type Document } from 'mongodb';
import ts from 'typescript';
import * as remoteWorkAccess from '../remote-work-access.ts';
import { toPublicPaymentSession } from '../payments/public-session.ts';

const ownerId = '507f1f77bcf86cd799439011';
const minutes = (value: number) => new Date(Date.now() + value * 60_000);

// Executa a rota real com dependências em memória: não abre conexão com MongoDB nem Auth0.
async function activeSessionFor(session: Document) {
    const matches = (filter: Document) => filter.$or.some((clause: Document) =>
        (typeof clause.status === 'string'
            ? clause.status === session.status
            : clause.status.$in.includes(session.status)) &&
        (!clause.expiresAt || session.expiresAt > clause.expiresAt.$gt));
    const collections: Record<string, { findOne: (filter: Document) => Promise<Document | null> }> = {
        'pagamentos.sessoes': { findOne: async (filter) => (matches(filter) ? session : null) },
        trabalhos_acessos_remotos: { findOne: async () => null },
        usuarios: { findOne: async () => null },
    };
    const modules: Record<string, unknown> = {
        mongodb: { ObjectId },
        'next/server': { NextResponse: { json: Response.json } },
        '@/lib/auth0-compat': {
            withApiAuthRequired: (handler: unknown) => handler,
            getSession: async () => ({ user: { sub: `auth0|${ownerId}` } }),
        },
        '@/lib/mongodb': {
            connectToDatabase: async () => ({ db: { collection: (name: string) => collections[name] } }),
        },
        '@/lib/payments/config': {
            getActivePaymentConfig: async () => ({ _id: 'config' }),
            getEditionId: () => 'CIEPS-2026',
        },
        '@/lib/payments/codes': { hasConfirmedRegistrationForEdition: async () => false },
        '@/lib/remote-work-access': remoteWorkAccess,
        '@/lib/payments/public-session': { toPublicPaymentSession },
    };
    const source = readFileSync(new URL('../../api/v1/remote-work-access/route.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    runInNewContext(outputText, {
        exports, Response, console,
        require: (name: string) => {
            assert.ok(name in modules, `Unexpected dependency: ${name}`);
            return modules[name];
        },
    });
    const response = await exports.GET(new Request('http://localhost/api/v1/remote-work-access'));
    assert.equal(response.status, 200);
    return (await response.json()).activeSession;
}

test('sessão OPEN vencida não bloqueia a criação de uma nova', async () => {
    assert.equal(await activeSessionFor({ status: 'OPEN', expiresAt: minutes(-1) }), false);
});

test('sessão OPEN dentro do prazo continua ativa', async () => {
    assert.equal((await activeSessionFor({ status: 'OPEN', expiresAt: minutes(10) })).status, 'OPEN');
});

test('cobrança já criada continua ativa mesmo após o prazo da sessão', async () => {
    const active = await activeSessionFor({ status: 'PAYMENT_PENDING', expiresAt: minutes(-30) });
    assert.equal(active.status, 'PAYMENT_PENDING');
});
