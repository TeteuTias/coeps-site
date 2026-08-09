import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {
    getCurrentAutomaticLot,
    lockPaymentCapacityCalculation,
    type ActivePaymentConfig,
} from '../../config.ts';
import { runPaymentTransaction } from '../../transactions.ts';

const editionId = 'CIEPS-2026';
const future = new Date('2030-01-01T00:00:00.000Z');
const now = new Date('2026-08-08T12:00:00.000Z');

function paymentConfig() {
    return {
        _id: new ObjectId(),
        edicaoId: editionId,
        ativo: true,
        dataInit: '2026-01-01',
        dataEnd: '2026-12-31',
        nome: 'CIEPS 2026',
        valorAVista: 100,
        valorBoleto: 100,
        valorDebito: 100,
        valorPix: 100,
        pagamentosAceitos: ['PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD'],
        parcelamentos: [],
        modo: 'automatico',
        configuracaoLotesAutomaticos: {
            lotes: [
                {
                    codigo: 1,
                    nome: 'Lote 1',
                    limiteVagas: 200,
                    precos: { valorAVista: 100, valorPix: 100, valorBoleto: 100, valorDebito: 100, parcelamentos: [] },
                },
                {
                    codigo: 2,
                    nome: 'Lote 2',
                    limiteVagas: 250,
                    precos: { valorAVista: 100, valorPix: 100, valorBoleto: 100, valorDebito: 100, parcelamentos: [] },
                },
                {
                    codigo: 3,
                    nome: 'Lote 3',
                    limiteVagas: 250,
                    precos: { valorAVista: 100, valorPix: 100, valorBoleto: 100, valorDebito: 100, parcelamentos: [] },
                },
            ],
        },
    } as unknown as ActivePaymentConfig;
}

function openSessions(quantity: number, offset = 0) {
    return Array.from({ length: quantity }, (_, index) => ({
        _id: new ObjectId(),
        owner: new ObjectId(),
        edicaoId: editionId,
        type: 'ticket',
        status: 'OPEN',
        expiresAt: future,
        createdAt: new Date(now.getTime() + offset + index),
        updatedAt: new Date(now.getTime() + offset + index),
    }));
}

test('700 inscricoes ocupam exatamente os tres lotes sem dupla contagem', async () => {
    const replicaSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
        binary: { version: '8.0.13' },
    });
    const client = new MongoClient(replicaSet.getUri());

    try {
        await client.connect();
        const db = client.db('capacity_700_boundaries');
        const config = paymentConfig();
        await db.collection('ingressos_config').insertOne(config);

        await db.collection('pagamentos.sessoes').insertMany(openSessions(199));
        assert.equal((await getCurrentAutomaticLot(db, config, now))?.codigo, 1);

        await db.collection('pagamentos.sessoes').insertOne(openSessions(1, 200)[0]);
        assert.equal((await getCurrentAutomaticLot(db, config, now))?.codigo, 2);

        await db.collection('pagamentos.sessoes').insertMany(openSessions(249, 201));
        assert.equal((await getCurrentAutomaticLot(db, config, now))?.codigo, 2);

        await db.collection('pagamentos.sessoes').insertOne(openSessions(1, 451)[0]);
        assert.equal((await getCurrentAutomaticLot(db, config, now))?.codigo, 3);

        await db.collection('pagamentos.sessoes').insertMany(openSessions(249, 452));
        assert.equal((await getCurrentAutomaticLot(db, config, now))?.codigo, 3);

        await db.collection('pagamentos.sessoes').insertOne(openSessions(1, 702)[0]);
        assert.equal(await getCurrentAutomaticLot(db, config, now), null);
        assert.equal(
            await db.collection('pagamentos.sessoes').countDocuments({ edicaoId: editionId }),
            700,
        );
    } finally {
        await client.close();
        await replicaSet.stop();
    }
});

test('25 tentativas concorrentes para as 10 vagas finais confirmam apenas 10 reservas', async () => {
    const replicaSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
        binary: { version: '8.0.13' },
    });
    const client = new MongoClient(replicaSet.getUri());

    try {
        await client.connect();
        const db = client.db('capacity_700_concurrency');
        const config = paymentConfig();
        await db.collection('ingressos_config').insertOne(config);
        await db.collection('pagamentos.sessoes').insertMany(openSessions(690));

        const attempts = await Promise.all(
            Array.from({ length: 25 }, async () => runPaymentTransaction(
                client,
                async (mongoSession) => {
                    await lockPaymentCapacityCalculation(db, config, mongoSession);
                    const lot = await getCurrentAutomaticLot(db, config, now, mongoSession);
                    if (!lot) return false;

                    await db.collection('pagamentos.sessoes').insertOne(
                        openSessions(1)[0],
                        { session: mongoSession },
                    );
                    return true;
                },
            )),
        );

        assert.equal(attempts.filter(Boolean).length, 10);
        assert.equal(
            await db.collection('pagamentos.sessoes').countDocuments({ edicaoId: editionId }),
            700,
        );
        assert.equal(await getCurrentAutomaticLot(db, config, now), null);
    } finally {
        await client.close();
        await replicaSet.stop();
    }
});
