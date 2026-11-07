import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHealthProfileComplement, validateRegistrationProfile } from '../registration-profile.ts';

test('complemento da saúde exige profissão, matrícula e unidade de origem', () => {
    const full = { profissao: ' Médica ', matricula_municipio: ' 123 ', unidade_origem: ' UBS Centro ' };
    const ok = validateHealthProfileComplement(full);
    assert.deepEqual(ok, { ok: true, value: { profession: 'Médica', municipalRegistration: '123', originUnit: 'UBS Centro' } });
    const messageWithout = (key: string) => {
        const result = validateHealthProfileComplement({ ...full, [key]: '' });
        return 'message' in result ? result.message : '';
    };
    assert.match(messageWithout('profissao'), /^Profissão/);
    assert.match(messageWithout('matricula_municipio'), /^Número da matrícula do município/);
    assert.match(messageWithout('unidade_origem'), /^Unidade de Origem/);
});

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
    matricula_municipio: '12345-6',
    unidade_origem: 'UBS Centro',
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
    assert.equal(result.ok && result.value.municipalRegistration, '12345-6');
    assert.equal(result.ok && result.value.originUnit, 'UBS Centro');
});

test('estudante descarta a matrícula do município e a unidade de origem', () => {
    const result = validateRegistrationProfile({ ...valid, situacao_academica: 'estudante' });
    assert.equal(result.ok && result.value.municipalRegistration, '');
    assert.equal(result.ok && result.value.originUnit, '');
});

test('formado sem matrícula ou com mais de 50 caracteres é recusado', () => {
    assert.match(messageOf({ matricula_municipio: '  ' }) ?? '', /^Número da matrícula do município/);
    assert.match(messageOf({ matricula_municipio: '1'.repeat(51) }) ?? '', /^Número da matrícula do município/);
});

test('formado sem unidade de origem ou com mais de 100 caracteres é recusado', () => {
    assert.match(messageOf({ unidade_origem: '  ' }) ?? '', /^Unidade de Origem/);
    assert.match(messageOf({ unidade_origem: 'a'.repeat(101) }) ?? '', /^Unidade de Origem/);
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
