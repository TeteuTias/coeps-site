import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistrationProfile } from '../registration-profile.ts';

const valid = {
    numero_telefone: '34999998888',
    address: 'Rua A',
    province: 'Centro',
    cidade: 'Araguari',
    pais: 'Brasil',
    data_nascimento: '1990-05-10',
    onde_conheceu: 'Instagram',
    situacao_academica: 'formado',
    curso: 'Medicina',
    profissao: 'Médica',
    ano_conclusao: '2015',
    semestre_conclusao: '2',
};

const messageOf = (overrides: Record<string, unknown>) => {
    const result = validateRegistrationProfile({ ...valid, ...overrides });
    return 'message' in result ? result.message : null;
};

test('cadastro válido de formado guarda a profissão', () => {
    const result = validateRegistrationProfile(valid);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.profession, 'Médica');
    assert.equal(result.ok && result.value.graduationYear, 2015);
});

test('estudante não precisa de profissão e não guarda o valor', () => {
    const result = validateRegistrationProfile({ ...valid, situacao_academica: 'estudante', profissao: 'x' });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.profession, '');
});

test('cada campo inválido devolve a mensagem do próprio campo', () => {
    assert.match(messageOf({ numero_telefone: '12345' }) ?? '', /^Telefone/);
    assert.match(messageOf({ profissao: '  ' }) ?? '', /^Profissão/);
    assert.match(messageOf({ ano_conclusao: '0000' }) ?? '', /^Ano de formação/);
    assert.match(messageOf({ situacao_academica: 'estudante', ano_conclusao: '' }) ?? '', /^Ano de conclusão/);
    assert.match(messageOf({ data_nascimento: '2020-02-31' }) ?? '', /^Data de nascimento/);
    assert.match(messageOf({ semestre_conclusao: '3' }) ?? '', /^Semestre/);
    assert.match(messageOf({ situacao_academica: '' }) ?? '', /^Situação acadêmica/);
});
