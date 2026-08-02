import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaymentCode } from '../codes.ts';

test('normaliza código sem depender de caixa, espaços ou pontuação', () => {
    assert.equal(normalizePaymentCode(' desc-ab12 cd34 '), 'DESCAB12CD34');
    assert.equal(normalizePaymentCode('rást-ana 01'), 'RASTANA01');
});

test('retorna vazio para entrada ausente ou de tipo inesperado', () => {
    assert.equal(normalizePaymentCode(undefined), '');
    assert.equal(normalizePaymentCode(1234), '');
});
