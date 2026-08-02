import type { ILoteAutomatico, IPrecosLote } from '@/lib/types/payments/payment.t';
import type {
    PaymentAmountsByMethod,
    PaymentAmountsSnapshot,
} from '@/lib/types/payments/paymentCode.t';

export function moneyToCents(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error('Valor monetário inválido.');
    }

    return Math.round((value + Number.EPSILON) * 100);
}

export function centsToMoney(value: number): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error('Valor em centavos inválido.');
    }

    return value / 100;
}

export function validateDiscountPercent(percent: number): number {
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
        throw new Error('O percentual de desconto deve ser um inteiro entre 1 e 99.');
    }

    return percent;
}

export function applyDiscountToCents(value: number, percent = 0): number {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error('Valor em centavos inválido.');
    }

    if (percent === 0) {
        return value;
    }

    validateDiscountPercent(percent);
    return Math.round((value * (100 - percent)) / 100);
}

function creditCardTotalCents(prices: IPrecosLote): number {
    const firstInstallment = prices.parcelamentos?.[0];

    if (!firstInstallment) {
        return moneyToCents(prices.valorAVista);
    }

    return moneyToCents(firstInstallment.valorCadaParcela) * firstInstallment.totalParcelas;
}

export function getAmountsByMethod(prices: IPrecosLote): PaymentAmountsByMethod {
    return {
        PIX: moneyToCents(prices.valorPix),
        BOLETO: moneyToCents(prices.valorBoleto),
        DEBIT_CARD: moneyToCents(prices.valorDebito),
        CREDIT_CARD: creditCardTotalCents(prices),
    };
}

export function applyDiscountToLot(
    lot: ILoteAutomatico,
    percent = 0,
): { lot: ILoteAutomatico; amounts: PaymentAmountsSnapshot } {
    const original = getAmountsByMethod(lot.precos);
    const final: PaymentAmountsByMethod = {
        PIX: applyDiscountToCents(original.PIX, percent),
        BOLETO: applyDiscountToCents(original.BOLETO, percent),
        DEBIT_CARD: applyDiscountToCents(original.DEBIT_CARD, percent),
        CREDIT_CARD: applyDiscountToCents(original.CREDIT_CARD, percent),
    };

    const discountedPrices: IPrecosLote = {
        ...lot.precos,
        valorPix: centsToMoney(final.PIX),
        valorBoleto: centsToMoney(final.BOLETO),
        valorDebito: centsToMoney(final.DEBIT_CARD),
        valorAVista: centsToMoney(
            applyDiscountToCents(moneyToCents(lot.precos.valorAVista), percent),
        ),
        parcelamentos: (lot.precos.parcelamentos ?? []).map((installment) => {
            const originalInstallmentCents = moneyToCents(installment.valorCadaParcela);
            const finalInstallmentCents = applyDiscountToCents(
                originalInstallmentCents,
                percent,
            );

            return {
                ...installment,
                valorCadaParcela: centsToMoney(finalInstallmentCents),
            };
        }),
    };

    const finalFromDiscountedLot = getAmountsByMethod(discountedPrices);

    return {
        lot: {
            ...lot,
            precos: discountedPrices,
        },
        amounts: {
            original,
            final: finalFromDiscountedLot,
            desconto: {
                PIX: original.PIX - finalFromDiscountedLot.PIX,
                BOLETO: original.BOLETO - finalFromDiscountedLot.BOLETO,
                DEBIT_CARD: original.DEBIT_CARD - finalFromDiscountedLot.DEBIT_CARD,
                CREDIT_CARD: original.CREDIT_CARD - finalFromDiscountedLot.CREDIT_CARD,
            },
        },
    };
}
