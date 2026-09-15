import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeParticipationMode,
    purchaserIsRemoteAuthor,
    validateAcademicWorkAuthors,
    validateAcademicWorkLimits,
} from '../academic-work-submission.ts';

const modality = { autores_por_trabalho: 3, maximo_orientadores: 1 };
const author = (email: string, isOrientador = false) => ({ nome: 'Pessoa Teste', email, cpf: '52998224725', isOrientador });

test('separates author and advisor limits', () => {
    assert.equal(validateAcademicWorkAuthors([author('a@example.com'), author('o@example.com', true)], modality).ok, true);
    assert.equal(validateAcademicWorkAuthors([author('a@example.com')], modality).ok, false);
    assert.equal(validateAcademicWorkAuthors([author('a@example.com'), author('o1@example.com', true), author('o2@example.com', true)], modality).ok, false);
    assert.equal(validateAcademicWorkAuthors([author('a@x.com'), author('b@x.com'), author('c@x.com'), author('d@x.com'), author('o@x.com', true)], modality).ok, false);
});

test('requires the authenticated purchaser as a non-advisor for remote work', () => {
    assert.equal(purchaserIsRemoteAuthor([author('OTHER@example.com'), author(' Buyer@example.com ')], 'buyer@example.com'), true);
    assert.equal(purchaserIsRemoteAuthor([author('buyer@example.com', true)], 'buyer@example.com'), false);
    assert.equal(purchaserIsRemoteAuthor([author('other@example.com')], 'buyer@example.com'), false);
});

test('applies global and modality limits independently', () => {
    assert.deepEqual(validateAcademicWorkLimits({ totalCount: 1, modalityCount: 0, globalLimit: 2, modalityLimit: 1 }), { ok: true });
    assert.equal(validateAcademicWorkLimits({ totalCount: 2, modalityCount: 0, globalLimit: 2, modalityLimit: 5 }).ok, false);
    const modalityResult = validateAcademicWorkLimits({ totalCount: 1, modalityCount: 1, globalLimit: 5, modalityLimit: 1 });
    assert.deepEqual(modalityResult.ok === false ? modalityResult.code : null, 'modality_work_limit_reached');
});

test('defaults unknown participation modes to regular', () => {
    assert.equal(normalizeParticipationMode('REMOTE'), 'REMOTE');
    assert.equal(normalizeParticipationMode('remote'), 'REGULAR');
    assert.equal(normalizeParticipationMode(undefined), 'REGULAR');
});
