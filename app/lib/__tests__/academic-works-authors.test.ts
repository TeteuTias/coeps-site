import assert from 'node:assert/strict';
import test from 'node:test';
import { getAcademicWorkAuthorLimits, validateAcademicWorkAuthors } from '../academic-works-authors.ts';

const resumo = { autores_por_trabalho: 15, maximo_orientadores: 1 };
const completo = { autores_por_trabalho: 3, maximo_orientadores: 1 };
const participants = (authors: number, advisors = 1) => [
  ...Array.from({ length: authors }, () => ({ isOrientador: false })),
  ...Array.from({ length: advisors }, () => ({ isOrientador: true })),
];

test('resumo admite 15 autores e 1 orientador, sem uma vaga extra', () => {
  assert.deepEqual(getAcademicWorkAuthorLimits(resumo), { total: 16, authors: 15, advisors: 1 });
  assert.equal(validateAcademicWorkAuthors(participants(15), resumo), null);
  assert.match(validateAcademicWorkAuthors(participants(16), resumo)!, /até 15 autores/);
});

test('trabalho completo admite 3 autores e 1 orientador', () => {
  assert.deepEqual(getAcademicWorkAuthorLimits(completo), { total: 4, authors: 3, advisors: 1 });
  assert.equal(validateAcademicWorkAuthors(participants(3), completo), null);
  assert.match(validateAcademicWorkAuthors(participants(4), completo)!, /até 3 autores/);
  assert.equal(validateAcademicWorkAuthors(participants(1), completo), null);
});

test('exige exatamente um orientador e pelo menos um autor', () => {
  for (const advisors of [0, 2]) {
    assert.match(validateAcademicWorkAuthors(participants(2, advisors), completo)!, /exatamente 1 orientador/);
  }
  assert.match(validateAcademicWorkAuthors(participants(0), completo)!, /pelo menos 1 autor/);
});

test('troca de resumo para completo revalida a lista preservada', () => {
  const autores = participants(15);
  assert.equal(validateAcademicWorkAuthors(autores, resumo), null);
  assert.match(validateAcademicWorkAuthors(autores, completo)!, /até 3 autores/);
  assert.equal(autores.length, 16);
});

test('rejeita listas e flags inválidas recebidas pela API', () => {
  for (const autores of [null, {}, [null], [{ isOrientador: 'true' }], [{}]]) {
    assert.match(validateAcademicWorkAuthors(autores, completo)!, /lista de autores é inválida/);
  }
});

test('configuração ausente ou inconsistente impede submissão', () => {
  for (const config of [undefined, { ...completo, autores_por_trabalho: 0 },
    { ...completo, autores_por_trabalho: 4.5 }, { ...completo, maximo_orientadores: 0 },
    { ...completo, maximo_orientadores: 1.5 }]) {
    assert.equal(getAcademicWorkAuthorLimits(config), null);
    assert.match(validateAcademicWorkAuthors(participants(3), config)!, /Configuração de autores inválida/);
  }
});

test('limites separados vêm da configuração, sem converter vagas de orientador em autores', () => {
  const config = { autores_por_trabalho: 3, maximo_orientadores: 2 };
  assert.deepEqual(getAcademicWorkAuthorLimits(config), { total: 5, authors: 3, advisors: 2 });
  assert.equal(validateAcademicWorkAuthors(participants(3, 2), config), null);
  assert.equal(validateAcademicWorkAuthors(participants(3, 1), config), null);
  assert.match(validateAcademicWorkAuthors(participants(4, 1), config)!, /até 3 autores/);
  assert.match(validateAcademicWorkAuthors(participants(1, 3), config)!, /máximo de orientadores permitido é 2/);
  assert.match(validateAcademicWorkAuthors(participants(3, 0), config)!, /pelo menos 1 orientador/);
});

test('aceita configuração mínima de 1 autor e 1 orientador', () => {
  const config = { autores_por_trabalho: 1, maximo_orientadores: 1 };
  assert.deepEqual(getAcademicWorkAuthorLimits(config), { total: 2, authors: 1, advisors: 1 });
  assert.equal(validateAcademicWorkAuthors(participants(1), config), null);
  assert.match(validateAcademicWorkAuthors(participants(2), config)!, /até 1 autor/);
});
