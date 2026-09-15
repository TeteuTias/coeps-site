import type { ActivePaymentConfig } from './config.ts';
import { applyDiscountToLot, centsToMoney, getAmountsByMethod } from './prices.ts';
import type { ILoteAutomatico, IPrecosLote } from '../types/payments/payment.t.ts';
import type {
    PaymentAmountsByMethod,
    PaymentAmountsSnapshot,
    PaymentCodeSnapshot,
    PaymentPriceOrigin,
    PaymentUserProfile,
} from '../types/payments/paymentCode.t.ts';

export class PaymentOfferError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(
        message: string,
        status: number,
        code: string,
    ) {
        super(message);
        this.name = 'PaymentOfferError';
        this.status = status;
        this.code = code;
    }
}

export interface ResolvedPaymentOffer {
    originalLot: ILoteAutomatico;
    finalLot: ILoteAutomatico;
    amounts: PaymentAmountsSnapshot;
    perfilUtilizador: PaymentUserProfile;
    origemPreco: PaymentPriceOrigin;
}

export function buildManualPaymentLot(config: ActivePaymentConfig): ILoteAutomatico {
    return {
        codigo: 0,
        nome: config.nome,
        limiteVagas: Number.MAX_SAFE_INTEGER,
        precos: {
            valorAVista: config.valorAVista,
            valorPix: config.valorPix,
            valorBoleto: config.valorBoleto,
            valorDebito: config.valorDebito,
            parcelamentos: config.parcelamentos ?? [],
        },
    };
}

function organizerTemplateLot(
    config: ActivePaymentConfig,
    currentLot: ILoteAutomatico | null,
): ILoteAutomatico {
    if (config.modo === 'manual') return currentLot ?? buildManualPaymentLot(config);

    const lots = config.configuracaoLotesAutomaticos?.lotes;
    const lastLot = Array.isArray(lots) ? lots.at(-1) : undefined;
    if (!lastLot) {
        throw new PaymentOfferError(
            'Configure ao menos um lote antes de habilitar inscrições de organizadores.',
            409,
            'ORGANIZER_INSTALLMENTS_NOT_CONFIGURED',
        );
    }
    return lastLot;
}

function organizerPrices(template: IPrecosLote, valueCents: number): IPrecosLote {
    return {
        valorAVista: centsToMoney(valueCents),
        valorPix: centsToMoney(valueCents),
        valorBoleto: centsToMoney(valueCents),
        valorDebito: centsToMoney(valueCents),
        parcelamentos: (template.parcelamentos ?? []).map((installment) => ({
            codigo: installment.codigo,
            totalParcelas: installment.totalParcelas,
            valorCadaParcela: centsToMoney(
                Math.round(valueCents / installment.totalParcelas),
            ),
        })),
    };
}

function fixedAmounts(
    original: PaymentAmountsByMethod,
    valueCents: number,
): PaymentAmountsSnapshot {
    const final: PaymentAmountsByMethod = {
        PIX: valueCents,
        BOLETO: valueCents,
        DEBIT_CARD: valueCents,
        CREDIT_CARD: valueCents,
    };
    return {
        original,
        final,
        desconto: {
            PIX: Math.max(0, original.PIX - valueCents),
            BOLETO: Math.max(0, original.BOLETO - valueCents),
            DEBIT_CARD: Math.max(0, original.DEBIT_CARD - valueCents),
            CREDIT_CARD: Math.max(0, original.CREDIT_CARD - valueCents),
        },
    };
}

export function resolvePaymentOffer(input: {
    config: ActivePaymentConfig;
    currentLot: ILoteAutomatico | null;
    discount?: PaymentCodeSnapshot;
}): ResolvedPaymentOffer {
    const profile: PaymentUserProfile =
        input.discount?.perfilUtilizador === 'ORGANIZADOR'
            ? 'ORGANIZADOR'
            : 'CONGRESSISTA';

    if (profile === 'ORGANIZADOR') {
        const valueCents = input.config.configuracaoOrganizador?.valorFinalCentavos;
        if (!Number.isInteger(valueCents) || Number(valueCents) <= 0) {
            throw new PaymentOfferError(
                'O preço de organizador ainda não foi configurado para esta edição.',
                409,
                'ORGANIZER_PRICE_NOT_CONFIGURED',
            );
        }

        const template = organizerTemplateLot(input.config, input.currentLot);
        const finalLot: ILoteAutomatico = {
            ...template,
            nome: 'Inscrição de organizador',
            precos: organizerPrices(template.precos, Number(valueCents)),
        };
        return {
            originalLot: template,
            finalLot,
            amounts: fixedAmounts(getAmountsByMethod(template.precos), Number(valueCents)),
            perfilUtilizador: profile,
            origemPreco: 'ORGANIZADOR_CONFIGURADO',
        };
    }

    if (!input.currentLot) {
        throw new PaymentOfferError(
            'Nenhum lote está disponível.',
            409,
            'PAYMENT_LOT_NOT_FOUND',
        );
    }

    const percent = input.discount?.percentualDesconto ?? 0;
    const discounted = applyDiscountToLot(input.currentLot, percent);
    return {
        originalLot: input.currentLot,
        finalLot: discounted.lot,
        amounts: discounted.amounts,
        perfilUtilizador: profile,
        origemPreco: percent > 0 ? 'DESCONTO_PERCENTUAL' : 'LOTE',
    };
}
