import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyDiscountToCents,
    applyDiscountToLot,
    moneyToCents,
    validateDiscountPercent,
} from '../prices.ts';

test('converte dinheiro para centavos sem erro de ponto flutuante', () => {
    assert.equal(moneyToCents(10.1), 1010);
    assert.equal(moneyToCents(189.99), 18999);
});

test('aplica desconto em centavos e arredonda uma única vez', () => {
    assert.equal(applyDiscountToCents(18000, 15), 15300);
    assert.equal(applyDiscountToCents(999, 10), 899);
    assert.equal(applyDiscountToCents(18000, 0), 18000);
});

test('mantém todos os preços quando não há desconto', () => {
    const lot = {
        codigo: 1,
        nome: 'Lote 1',
        limiteVagas: 100,
        precos: {
            valorAVista: 180,
            valorPix: 175,
            valorBoleto: 180,
            valorDebito: 180,
            parcelamentos: [
                { codigo: 1, valorCadaParcela: 180, totalParcelas: 1 },
                { codigo: 2, valorCadaParcela: 63, totalParcelas: 3 },
            ],
        },
    };

    const result = applyDiscountToLot(lot, 0);
    assert.deepEqual(result.lot, lot);
    assert.equal(result.amounts.desconto.PIX, 0);
    assert.equal(result.amounts.final.CREDIT_CARD, 18000);
});

test('desconta cada opção e mantém o total parcelado igual ao enviado ao gateway', () => {
    const result = applyDiscountToLot(
        {
            codigo: 1,
            nome: 'Lote 1',
            limiteVagas: 100,
            precos: {
                valorAVista: 180,
                valorPix: 175,
                valorBoleto: 180,
                valorDebito: 180,
                parcelamentos: [{ codigo: 2, valorCadaParcela: 63, totalParcelas: 3 }],
            },
        },
        15,
    );

    assert.equal(result.lot.precos.valorPix, 148.75);
    assert.equal(result.lot.precos.parcelamentos[0].valorCadaParcela, 53.55);
    assert.equal(result.amounts.final.CREDIT_CARD, 16065);
    assert.equal(result.amounts.desconto.CREDIT_CARD, 2835);
});

test('recusa percentuais fora da primeira versão', () => {
    assert.throws(() => validateDiscountPercent(0));
    assert.throws(() => validateDiscountPercent(100));
    assert.throws(() => validateDiscountPercent(10.5));
});
