import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, findCandidates } from '../../../../scripts/payments/orphan-activity-charges.mjs';

const ativa = { _id: 'a1', name: 'APH Tático (TURMA 1)', participants: ['u_inscrito', 'u_dup'] };
const charge = (id: string, eventId: string) => ({ id, _type: 'activity', _eventID: eventId, value: 55 });

test('candidatas: fora da atividade, atividade inexistente e duplicadas; inscrito normal fica de fora', () => {
    const users = [
        { _id: 'u_inscrito', pagamento: { lista_pagamentos: [charge('p_ok', 'a1'), { id: 'p_ticket', _type: 'ticket' }] } },
        { _id: 'u_removido', pagamento: { lista_pagamentos: [charge('p_orfa', 'a1')] } },
        { _id: 'u_sumiu', pagamento: { lista_pagamentos: [charge('p_sem_atividade', 'apagada')] } },
        { _id: 'u_dup', pagamento: { lista_pagamentos: [charge('p_dup1', 'a1'), charge('p_dup2', 'a1')] } },
        { _id: 'u_sem_pagamento' },
    ];
    const found = findCandidates(users, [ativa]);
    assert.deepEqual(found.map((c: { chargeId: string }) => c.chargeId), ['p_orfa', 'p_sem_atividade', 'p_dup1', 'p_dup2']);
    assert.equal(found[0].inscrito, false);
    assert.equal(found[1].atividadeExiste, false);
});

test('classificação: só pendente ou vencida de quem saiu vira "cancelar"', () => {
    const removido = { atividadeExiste: true, inscrito: false };
    assert.equal(classify(removido, { status: 'PENDING' }), 'cancelar');
    assert.equal(classify(removido, { status: 'OVERDUE' }), 'cancelar');
    assert.equal(classify(removido, { status: 'RECEIVED' }), 'revisar-paga-sem-inscricao');
    assert.equal(classify(removido, { status: 'REFUNDED' }), 'ok');
    assert.equal(classify(removido, { status: 'PENDING', deleted: true }), 'ja-excluida-no-asaas');
    assert.equal(classify(removido, { notFound: true }), 'ja-excluida-no-asaas');
    assert.equal(classify(removido, { error: 'HTTP 500' }), 'erro-consulta');

    // Atividade recriada à mão muda de _id: não dá para concluir que a inscrição foi cancelada.
    assert.equal(classify({ atividadeExiste: false, inscrito: false }, { status: 'PENDING' }), 'revisar-atividade-inexistente');

    const inscrito = { atividadeExiste: true, inscrito: true };
    assert.equal(classify(inscrito, { status: 'PENDING' }), 'revisar-cobranca-duplicada');
    assert.equal(classify(inscrito, { status: 'RECEIVED' }), 'ok');
});
