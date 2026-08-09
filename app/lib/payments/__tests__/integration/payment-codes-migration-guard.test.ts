import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server: MongoMemoryServer;
let client: MongoClient;

before(async () => {
    server = await MongoMemoryServer.create({
        binary: { version: '8.0.13' },
        instance: { dbName: 'payment-migration-guard' },
    });
    client = new MongoClient(server.getUri());
    await client.connect();
});

after(async () => {
    await client?.close();
    await server?.stop();
});

function runMigration(environment: NodeJS.ProcessEnv): Promise<{
    code: number | null;
    stderr: string;
}> {
    return new Promise((resolve, reject) => {
        const migration = spawn(
            process.execPath,
            [path.join(process.cwd(), 'scripts/migrations/setup-payment-codes.mjs')],
            {
                cwd: process.cwd(),
                env: environment,
                stdio: ['ignore', 'ignore', 'pipe'],
            },
        );
        let stderr = '';
        migration.stderr.setEncoding('utf8');
        migration.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        migration.once('error', reject);
        migration.once('close', (code) => resolve({ code, stderr }));
    });
}

test('migração completa para antes de classificar pagante legado em edição por suposição', async () => {
    const databaseName = `migration-guard-${new ObjectId().toHexString()}`;
    const db = client.db(databaseName);
    const configId = new ObjectId();
    const userId = new ObjectId();

    await db.collection('ingressos_config').insertOne({
        _id: configId,
        edicaoId: 'COEPS-2025',
        ativo: true,
    });
    await db.collection('usuarios').insertOne({
        _id: userId,
        pagamento: {
            situacao: 1,
            tipo_pagamento: 'asaas',
        },
    });

    const result = await runMigration({
        ...process.env,
        MONGODB_URI: server.getUri(),
        MONGODB_DB: databaseName,
        PAYMENT_EDITION_ID: 'CIEPS-2026',
        PAYMENT_CONFIG_ID: configId.toHexString(),
    });

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /edicaoId/);

    const [config, user] = await Promise.all([
        db.collection('ingressos_config').findOne({ _id: configId }),
        db.collection('usuarios').findOne({ _id: userId }),
    ]);
    assert.equal(config?.edicaoId, 'COEPS-2025');
    assert.equal(config?.ativo, true);
    assert.equal(user?.pagamento?.edicaoId, undefined);
});
