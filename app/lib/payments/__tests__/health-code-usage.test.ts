import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { claimHealthCodeUse, PaymentCodeError, previewPaymentCodes } from '../codes.ts';

process.env.PAYMENT_CODES_ENABLED = 'true';

const healthCode = {
    _id: new ObjectId(),
    edicaoId: 'CIEPS-2026',
    codigo: 'D-CIEPS2026-ABC123',
    codigoNormalizado: 'DCIEPS2026ABC123',
    tipo: 'DESCONTO',
    perfilUtilizador: 'PROFISSIONAL_SAUDE',
    status: 'ATIVO',
    limiteUsos: 100,
    usosRealizados: 37,
};

function fakeDb(found: Record<string, unknown> | null) {
    const calls: { filter: Record<string, any>; update?: any[] }[] = [];
    const collection = () => ({
        findOneAndUpdate: async (filter: Record<string, any>, update: any[]) => {
            calls.push({ filter, update });
            return found;
        },
        findOne: async () => found,
    });
    return { db: { collection } as never, calls };
}

test('claim conta um uso com filtro atômico limitado por limiteUsos', async () => {
    const { db, calls } = fakeDb(healthCode);
    const snapshot = await claimHealthCodeUse(db, { edicaoId: 'CIEPS-2026', codigo: 'd-cieps2026-abc123' });

    assert.equal(snapshot.perfilUtilizador, 'PROFISSIONAL_SAUDE');
    const { filter, update } = calls[0];
    assert.equal(filter.codigoNormalizado, 'DCIEPS2026ABC123');
    assert.equal(filter.perfilUtilizador, 'PROFISSIONAL_SAUDE');
    assert.equal(filter.status, 'ATIVO');
    assert.deepEqual(filter.$expr, { $lt: [{ $ifNull: ['$usosRealizados', 0] }, { $ifNull: ['$limiteUsos', 1] }] });

    const stage = update?.[0].$set;
    assert.deepEqual(stage.usosRealizados, { $add: [{ $ifNull: ['$usosRealizados', 0] }, 1] });
    // No último uso o código passa a USADO; antes disso continua ATIVO.
    assert.deepEqual(stage.status.$cond[1], 'USADO');
    assert.deepEqual(stage.status.$cond[2], 'ATIVO');
});

test('claim recusa código esgotado ou inexistente', async () => {
    const { db } = fakeDb(null);
    await assert.rejects(
        claimHealthCodeUse(db, { edicaoId: 'CIEPS-2026', codigo: 'D-CIEPS2026-ABC123' }),
        (error) => error instanceof PaymentCodeError && error.code === 'PAYMENT_CODE_EXHAUSTED',
    );
});

test('preview recusa código com todos os usos já feitos', async () => {
    const { db } = fakeDb({ ...healthCode, usosRealizados: 100 });
    await assert.rejects(
        previewPaymentCodes(db, { edicaoId: 'CIEPS-2026', codigoDesconto: 'D-CIEPS2026-ABC123' }),
        (error) => error instanceof PaymentCodeError && error.code === 'PAYMENT_CODE_EXHAUSTED',
    );
});

test('preview aceita código com usos restantes', async () => {
    const { db } = fakeDb(healthCode);
    const preview = await previewPaymentCodes(db, { edicaoId: 'CIEPS-2026', codigoDesconto: 'D-CIEPS2026-ABC123' });
    assert.equal(preview.desconto?.perfilUtilizador, 'PROFISSIONAL_SAUDE');
});
