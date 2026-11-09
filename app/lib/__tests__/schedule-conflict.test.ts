import assert from 'node:assert/strict';
import test from 'node:test';
import { hasScheduleConflict } from '../schedule-conflict.js';

const slot = (inicio: string, fim: string) => ({
    timeline: [{ date_init: `2026-11-14T${inicio}:00-03:00`, date_end: `2026-11-14T${fim}:00-03:00` }],
});

test('horários encostados não conflitam (19:30–20:30 e simulação 20:30–21:30)', () => {
    assert.equal(hasScheduleConflict([slot('19:30', '20:30')], slot('20:30', '21:30')), 0);
    assert.equal(hasScheduleConflict([slot('20:30', '21:30')], slot('19:30', '20:30')), 0);
    assert.equal(hasScheduleConflict([slot('07:00', '08:00')], slot('08:00', '10:00')), 0);
});

test('sobreposição real conflita', () => {
    assert.equal(hasScheduleConflict([slot('19:30', '20:45')], slot('20:30', '21:30')), 1);
    assert.equal(hasScheduleConflict([slot('20:30', '21:30')], slot('20:30', '21:30')), 1);
    assert.equal(hasScheduleConflict([slot('08:00', '12:00')], slot('09:00', '10:00')), 1);
    assert.equal(hasScheduleConflict([slot('09:00', '10:00')], slot('08:00', '12:00')), 1);
    assert.equal(hasScheduleConflict([slot('08:00', '10:00')], slot('08:00', '09:00')), 1);
});

test('horários separados não conflitam', () => {
    assert.equal(hasScheduleConflict([slot('08:00', '10:00')], slot('14:00', '16:00')), 0);
    assert.equal(hasScheduleConflict([], slot('14:00', '16:00')), 0);
});
