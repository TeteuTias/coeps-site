import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentOfferError, resolvePaymentOffer } from '../offer.ts';

const firstLot = {
    codigo: 1,
    nome: 'Primeiro lote',
    limiteVagas: 100,
    precos: {
        valorAVista: 400,
        valorPix: 390,
        valorBoleto: 400,
        valorDebito: 400,
        parcelamentos: [{ codigo: 31, totalParcelas: 3, valorCadaParcela: 150 }],
    },
};

const lastLot = {
    codigo: 2,
    nome: 'Último lote',
    limiteVagas: 100,
    precos: {
        valorAVista: 600,
        valorPix: 580,
        valorBoleto: 600,
        valorDebito: 600,
        parcelamentos: [
            { codigo: 61, totalParcelas: 3, valorCadaParcela: 220 },
            { codigo: 62, totalParcelas: 6, valorCadaParcela: 115 },
        ],
    },
};

function automaticConfig(organizerValue = 25_000) {
    return {
        _id: 'config-1',
        nome: 'CIEPS 2026',
        edicaoId: 'CIEPS-2026',
        modo: 'automatico',
        configuracaoOrganizador: { valorFinalCentavos: organizerValue },
        configuracaoLotesAutomaticos: { lotes: [firstLot, lastLot] },
    } as never;
}

test('organizador usa preço exato em todos os meios mesmo com lote esgotado', () => {
    const offer = resolvePaymentOffer({
        config: automaticConfig(),
        currentLot: null,
        discount: {
            codigo: 'D-2026-ORGANIZADOR',
            codigoNormalizado: 'D2026ORGANIZADOR',
            perfilUtilizador: 'ORGANIZADOR',
            tipo: 'DESCONTO',
        } as never,
    });

    assert.equal(offer.perfilUtilizador, 'ORGANIZADOR');
    assert.equal(offer.origemPreco, 'ORGANIZADOR_CONFIGURADO');
    assert.deepEqual(offer.amounts.final, {
        PIX: 25_000,
        BOLETO: 25_000,
        DEBIT_CARD: 25_000,
        CREDIT_CARD: 25_000,
    });
    assert.equal(offer.finalLot.precos.valorPix, 250);
    assert.equal(offer.finalLot.precos.valorBoleto, 250);
    assert.equal(offer.finalLot.precos.valorDebito, 250);
    assert.equal(offer.finalLot.precos.valorAVista, 250);
});

test('organizador copia apenas as quantidades de parcelas do último lote', () => {
    const offer = resolvePaymentOffer({
        config: automaticConfig(),
        currentLot: firstLot as never,
        discount: { perfilUtilizador: 'ORGANIZADOR' } as never,
    });

    assert.equal(offer.originalLot.codigo, lastLot.codigo);
    assert.deepEqual(
        offer.finalLot.precos.parcelamentos.map((item) => item.totalParcelas),
        [3, 6],
    );
    assert.deepEqual(
        offer.finalLot.precos.parcelamentos.map((item) => item.valorCadaParcela),
        [83.33, 41.67],
    );
});

test('rastreio ou perfil legado não libera venda sem lote', () => {
    assert.throws(
        () => resolvePaymentOffer({ config: automaticConfig(), currentLot: null }),
        (error) => error instanceof PaymentOfferError && error.code === 'PAYMENT_LOT_NOT_FOUND',
    );
});

test('falha explicitamente quando preço de organizador não está configurado', () => {
    assert.throws(
        () => resolvePaymentOffer({
            config: automaticConfig(0),
            currentLot: null,
            discount: { perfilUtilizador: 'ORGANIZADOR' } as never,
        }),
        (error) =>
            error instanceof PaymentOfferError && error.code === 'ORGANIZER_PRICE_NOT_CONFIGURED',
    );
});

test('desconto de congressista mantém cálculo percentual e ocupa lote', () => {
    const offer = resolvePaymentOffer({
        config: automaticConfig(),
        currentLot: firstLot as never,
        discount: { perfilUtilizador: 'CONGRESSISTA', percentualDesconto: 25 } as never,
    });

    assert.equal(offer.origemPreco, 'DESCONTO_PERCENTUAL');
    assert.equal(offer.perfilUtilizador, 'CONGRESSISTA');
    assert.deepEqual(offer.amounts.final, {
        PIX: 29_250,
        BOLETO: 30_000,
        DEBIT_CARD: 30_000,
        CREDIT_CARD: 33_750,
    });
});
