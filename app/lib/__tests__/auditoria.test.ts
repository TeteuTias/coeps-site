import test from 'node:test';
import assert from 'node:assert/strict';
import { ATOR_SISTEMA, atorCongressista, COLECAO_LOGS, montarLog, origemDoPedido, registrarLog, sanitizar } from '../auditoria.js';

test('sanitizar tira CPF, token, cartão e QR do PIX', () => {
    const s = sanitizar({ nome: 'Ana', cpfCnpj: '1', pixQrCode: 'x', creditCard: { n: 1 }, access_token: 't', value: 50 }) as Record<string, unknown>;
    assert.equal(s.nome, 'Ana');
    assert.equal(s.cpfCnpj, '[oculto]');
    assert.equal(s.pixQrCode, '[oculto]');
    assert.equal(s.creditCard, '[oculto]');
    assert.equal(s.access_token, '[oculto]');
    assert.equal(s.value, 50);
});

test('montarLog: alvo em texto, sem campos vazios, chave vira _id', () => {
    const doc = montarLog({
        origem: 'sistema', acao: 'inscricao.liberacao_automatica', categoria: 'inscricao', resumo: 'x',
        ator: ATOR_SISTEMA, alvo: { usuarioId: 'u1', minicursoId: null, cobrancaId: 'pay_1' }, chave: 'liberacao:pay_1:released',
    }) as Record<string, any>;
    assert.equal(doc._id, 'liberacao:pay_1:released');
    assert.deepEqual(doc.alvo, { usuarioId: 'u1', cobrancaId: 'pay_1' });
    assert.equal(doc.sucesso, true);
    assert.ok(doc.em instanceof Date);
});

test('origem do pedido: primeiro IP do x-forwarded-for, navegador e rota', () => {
    const r = new Request('https://site/api/put/inscreverAtividade', { method: 'PUT', headers: { 'x-forwarded-for': '177.1.1.1, 10.0.0.1', 'user-agent': 'Safari' } });
    assert.deepEqual(origemDoPedido(r), { ip: '177.1.1.1', userAgent: 'Safari', rota: '/api/put/inscreverAtividade', metodo: 'PUT' });
});

test('registrarLog: com chave grava uma vez (upsert $setOnInsert); erro não derruba a ação', async () => {
    const chamadas: unknown[][] = [];
    const db = {
        collection: (nome: string) => ({
            findOne: async () => null,
            updateOne: async (...args: unknown[]) => { assert.equal(nome, COLECAO_LOGS); chamadas.push(args); return {}; },
            insertOne: async () => { throw new Error('não devia inserir'); },
        }),
    };
    assert.equal(await registrarLog(db, { origem: 'site', acao: 'a', categoria: 'inscricao', resumo: 'r', ator: atorCongressista('u1'), chave: 'k1' }), true);
    const [filtro, update, opcoes] = chamadas[0] as [any, any, any];
    assert.deepEqual(filtro, { _id: 'k1' });
    assert.ok(update.$setOnInsert);
    assert.equal(opcoes.upsert, true);

    const quebrado = { collection: () => ({ findOne: async () => null, insertOne: async () => { throw new Error('fora'); } }) };
    assert.equal(await registrarLog(quebrado, { origem: 'site', acao: 'a', categoria: 'inscricao', resumo: 'r', ator: atorCongressista('u1') }), false);
});
