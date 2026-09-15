import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { getActivePaymentConfig, getCurrentAutomaticLot } from '../config.ts';

test('conta comprador moderno uma unica vez e exige compraId ausente no legado', async () => {
    const calls: Array<{ collection: string; filter?: Record<string, unknown>; pipeline?: unknown[] }> = [];
    const counts: Record<string, number[]> = {
        usuarios: [1],
        'pagamentos.atribuicoes': [1],
        'pagamentos.sessoes': [0],
    };
    const db = {
        collection(name: string) {
            return {
                async countDocuments(filter: Record<string, unknown>) {
                    calls.push({ collection: name, filter });
                    return counts[name].shift() ?? 0;
                },
                aggregate(pipeline: unknown[]) {
                    calls.push({ collection: name, pipeline });
                    return {
                        async toArray() {
                            return [{ total: counts[name].shift() ?? 0 }];
                        },
                    };
                },
            };
        },
    };
    const config = {
        _id: new ObjectId(),
        edicaoId: 'CIEPS-2026',
        configuracaoLotesAutomaticos: {
            lotes: [
                { codigo: 1, nome: 'Lote 1', limiteVagas: 2, precos: {} },
                { codigo: 2, nome: 'Lote 2', limiteVagas: 2, precos: {} },
            ],
        },
    };

    const lot = await getCurrentAutomaticLot(db as never, config as never);

    assert.equal(lot?.codigo, 2);
    const legacyCall = calls.find((call) => call.collection === 'usuarios');
    assert.deepEqual(legacyCall?.filter?.['pagamento.compraId'], { $exists: false });
    const assignmentPipeline = calls.find(
        (call) => call.collection === 'pagamentos.atribuicoes',
    )?.pipeline as Array<Record<string, unknown>> | undefined;
    assert.deepEqual((assignmentPipeline?.[0]?.$match as Record<string, unknown>)?.$or, [
        { type: 'ticket' },
        { type: { $exists: false } },
    ]);
    assert.deepEqual(assignmentPipeline?.at(-2), {
        $match: { perfilUtilizadorResolvido: { $ne: 'ORGANIZADOR' } },
    });
    const sessionPipeline = calls.find(
        (call) => call.collection === 'pagamentos.sessoes',
    )?.pipeline as Array<Record<string, unknown>> | undefined;
    const sessionMatch = sessionPipeline?.[0]?.$match as Record<string, unknown>;
    assert.deepEqual((sessionMatch.$and as Array<Record<string, unknown>>)?.[0], {
        $or: [{ type: 'ticket' }, { type: { $exists: false } }],
    });
});

test('falha fechado quando a edicao configurada nao existe ativa', async () => {
    const previousEdition = process.env.PAYMENT_EDITION_ID;
    const filters: Record<string, unknown>[] = [];
    const db = {
        collection() {
            return {
                async findOne(filter: Record<string, unknown>) {
                    filters.push(filter);
                    return null;
                },
            };
        },
    };

    try {
        process.env.PAYMENT_EDITION_ID = 'CIEPS-2026';
        assert.equal(await getActivePaymentConfig(db as never), null);
        assert.deepEqual(filters, [{ edicaoId: 'CIEPS-2026', ativo: true }]);
    } finally {
        if (previousEdition === undefined) delete process.env.PAYMENT_EDITION_ID;
        else process.env.PAYMENT_EDITION_ID = previousEdition;
    }
});
