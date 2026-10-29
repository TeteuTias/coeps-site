import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { confirmCourtesyTicket } from '../courtesy-ticket.ts';
import { PaymentCodeError } from '../codes.ts';

type Call = { name: string; op: string; filter: Record<string, unknown>; update?: Record<string, any> };

function fakeDb({ userMatched = 1, codeConsumed = true } = {}) {
    const calls: Call[] = [];
    const collection = (name: string) => ({
        updateOne: async (filter: Record<string, unknown>, update: Record<string, any>) => {
            calls.push({ name, op: 'updateOne', filter, update });
            return { matchedCount: name === 'usuarios' ? userMatched : 1, modifiedCount: 1 };
        },
        findOneAndUpdate: async (filter: Record<string, unknown>, update: Record<string, any>) => {
            calls.push({ name, op: 'findOneAndUpdate', filter, update });
            return codeConsumed ? { _id: new ObjectId() } : null;
        },
        findOne: async () => null,
    });
    return { db: { collection } as never, calls };
}

const amounts = {
    original: { PIX: 39_000, BOLETO: 40_000, DEBIT_CARD: 40_000, CREDIT_CARD: 45_000 },
    desconto: { PIX: 39_000, BOLETO: 40_000, DEBIT_CARD: 40_000, CREDIT_CARD: 45_000 },
    final: { PIX: 0, BOLETO: 0, DEBIT_CARD: 0, CREDIT_CARD: 0 },
};

function courtesySession() {
    return {
        _id: new ObjectId(),
        owner: new ObjectId(),
        edicaoId: 'CIEPS-2026',
        valoresCentavos: amounts,
        perfilUtilizador: 'PROFISSIONAL_SAUDE',
        codigoDesconto: { codigo: 'D-2026-ABC', codigoNormalizado: 'D2026ABC', perfilUtilizador: 'PROFISSIONAL_SAUDE' },
    };
}

test('profissional da saúde: confirma inscrição, registra valor zero, marca o usuário e consome o código', async () => {
    const { db, calls } = fakeDb();
    const session = courtesySession();
    await confirmCourtesyTicket(db, session, {} as never);

    const user = calls.find((call) => call.name === 'usuarios');
    assert.deepEqual(user?.filter['pagamento.situacao'], { $ne: 1 });
    assert.equal(user?.update?.$set['pagamento.situacao'], 1);
    assert.equal(user?.update?.$set['pagamento.tipo_pagamento'], 'profissional_saude');
    assert.equal(user?.update?.$set['pagamento.compraId'], session._id);

    const assignment = calls.find((call) => call.name === 'pagamentos.atribuicoes')?.update?.$setOnInsert;
    assert.equal(assignment.status, 'CONFIRMADA');
    assert.equal(assignment.origemPreco, 'CORTESIA');
    assert.equal(assignment.pagamento.metodo, 'CORTESIA');
    assert.deepEqual(assignment.valorSelecionadoCentavos, { original: 39_000, desconto: 39_000, final: 0 });

    const code = calls.find((call) => call.name === 'pagamentos.codigos');
    assert.equal(code?.update?.$set.status, 'USADO');
    assert.ok(calls.some((call) => call.name === 'pagamentos.comprovantes'));
});

test('cortesia recusa usuário já inscrito para não gastar o código', async () => {
    const { db, calls } = fakeDb({ userMatched: 0 });
    await assert.rejects(
        confirmCourtesyTicket(db, courtesySession(), {} as never),
        (error) => error instanceof PaymentCodeError && error.code === 'REGISTRATION_ALREADY_CONFIRMED',
    );
    assert.equal(calls.some((call) => call.name === 'pagamentos.codigos'), false);
});

test('cortesia falha se o código reservado não puder ser consumido', async () => {
    const { db } = fakeDb({ codeConsumed: false });
    await assert.rejects(
        confirmCourtesyTicket(db, courtesySession(), {} as never),
        /COURTESY_CODE_CONSUMPTION_FAILED/,
    );
});
