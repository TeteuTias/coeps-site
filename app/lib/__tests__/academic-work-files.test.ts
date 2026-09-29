import assert from 'node:assert/strict';
import test from 'node:test';
import {
    validateWorkFile, validateWorkFileSlots, workSubmissionIsOpen,
} from '../academic-work-files.ts';

test('resumo aceita PDF e DOCX quando ambos estão configurados', () => {
    const requirement = { titulo: 'Resumo de trabalho', formatos: ['.pdf', '.docx'] };
    assert.equal(validateWorkFile({ name: 'resumo.pdf', size: 1024, contentType: 'application/pdf' }, requirement, 10_000), null);
    assert.equal(validateWorkFile({
        name: 'resumo.docx', size: 1024,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }, requirement, 10_000), null);
    assert.match(validateWorkFile({ name: 'resumo.doc', size: 1024 }, requirement, 10_000)!, /Formato inválido/);
    assert.match(validateWorkFile({ name: 'resumo.docx', size: 1024, contentType: 'application/pdf' }, requirement, 10_000)!, /não corresponde/);
    assert.match(validateWorkFile({ name: 'resumo.pdf', size: 0 }, requirement, 10_000)!, /vazio/);
});

test('cada requisito exige um ID distinto, mas os nomes dos arquivos podem se repetir', () => {
    const requirements = [
        { titulo: 'Sem identificação', formatos: ['.docx'] },
        { titulo: 'Com identificação', formatos: ['.docx'] },
        { titulo: 'Resumo', formatos: ['.pdf', '.docx'] },
    ];
    assert.equal(validateWorkFileSlots([
        { slotIndex: 2, fileId: 'id3' }, { slotIndex: 0, fileId: 'id1' }, { slotIndex: 1, fileId: 'id2' },
    ], requirements), null);
    assert.match(validateWorkFileSlots([{ slotIndex: 0, fileId: 'id1' }], requirements)!, /um arquivo para cada/);
    assert.match(validateWorkFileSlots([
        { slotIndex: 0, fileId: 'id1' }, { slotIndex: 1, fileId: 'id1' }, { slotIndex: 2, fileId: 'id3' },
    ], requirements)!, /repetidos/);
    assert.match(validateWorkFileSlots([
        { slotIndex: 0, fileId: 'id1' }, { slotIndex: 0, fileId: 'id2' }, { slotIndex: 2, fileId: 'id3' },
    ], requirements)!, /repetidos/);
});

test('abertura e fechamento usam horário completo do prazo', () => {
    const config = {
        isOpen: true,
        data_inicio_submissao: '2026-09-05T09:00:00-03:00',
        data_limite_submissao: '2026-10-12T23:59:59-03:00',
    };
    assert.equal(workSubmissionIsOpen(config, new Date('2026-09-05T08:59:59-03:00')), false);
    assert.equal(workSubmissionIsOpen(config, new Date('2026-09-05T09:00:00-03:00')), true);
    assert.equal(workSubmissionIsOpen(config, new Date('2026-10-06T00:00:00-03:00')), true);
    assert.equal(workSubmissionIsOpen(config, new Date('2026-10-12T23:59:59-03:00')), true);
    assert.equal(workSubmissionIsOpen(config, new Date('2026-10-13T00:00:00-03:00')), false);
    assert.equal(workSubmissionIsOpen({ ...config, isOpen: false }, new Date('2026-09-29T12:00:00-03:00')), false);
});
