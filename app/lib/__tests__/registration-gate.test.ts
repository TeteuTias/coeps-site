import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRegistrationRedirect,
    isRegistrationProfileComplete,
} from '../registration-gate.ts';

const decide = (
    path: string,
    profileComplete: boolean,
    paymentConfirmed: boolean,
    confirmationSeen = false,
) => getRegistrationRedirect({ path, profileComplete, paymentConfirmed, confirmationSeen });

test('usuário incompleto paga antes de acessar o formulário completo', () => {
    assert.equal(decide('/painel', false, false), '/pagamentos');
    assert.equal(decide('/pagamentos', false, false), null);
    assert.equal(decide('/painel/dadosIniciais', false, false), '/pagamentos');
    assert.equal(decide('/pagamentos', false, true), '/painel/dadosIniciais');
    assert.equal(decide('/painel/dadosIniciais', false, true), null);
    assert.equal(decide('/painel/trabalhos', false, true), '/painel/dadosIniciais');
});

test('usuário completo preserva gate financeiro e confirmação visual', () => {
    assert.equal(decide('/painel', true, false), '/pagamentos');
    assert.equal(decide('/painel/certificados', true, false), null);
    assert.equal(decide('/painel', true, true), '/painel/suaInscricaoFoiConfirmada');
    assert.equal(decide('/painel/suaInscricaoFoiConfirmada', true, true), null);
    assert.equal(decide('/painel/suaInscricaoFoiConfirmada', true, true, true), '/painel');
    assert.equal(decide('/painel/trabalhos', true, true, true), null);
});

test('flag de cadastro sem perfil real não permite pular o formulário', () => {
    assert.equal(isRegistrationProfileComplete({
        isPos_registration: true,
        informacoes_usuario: { nome: '', cpf: '', numero_telefone: '' },
    }), false);
    assert.equal(isRegistrationProfileComplete({
        isPos_registration: true,
        informacoes_usuario: {
            nome: 'Maria da Silva',
            cpf: '529.982.247-25',
            numero_telefone: '(34) 99999-9999',
        },
    }), true);
});
