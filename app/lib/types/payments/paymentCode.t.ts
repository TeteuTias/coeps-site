import type { ObjectId } from 'mongodb';
import type { ILoteAutomatico } from './payment.t';

export type PaymentCodeType = 'DESCONTO' | 'RASTREIO';
export type PaymentCodeStatus = 'ATIVO' | 'RESERVADO' | 'INATIVO' | 'USADO';

export type PaymentAssignmentStatus =
    | 'ABERTA'
    | 'PAGAMENTO_PENDENTE'
    | 'CONFIRMADA'
    | 'CANCELADA'
    | 'EXPIRADA'
    | 'ESTORNADA';

export type PaymentSessionStatus =
    | 'OPEN'
    | 'CREATING_PAYMENT'
    | 'PAYMENT_PENDING'
    | 'PAYMENT_REVIEW_REQUIRED'
    | 'CONFIRMED'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'REFUNDED';

export interface PaymentCodeOwner {
    nome: string;
    email?: string;
    telefone?: string;
    documento?: string;
}

export interface PaymentCodeReservation {
    compraId: ObjectId;
    usuarioId: ObjectId;
    reservadoEm: Date;
    reservadoAte: Date | null;
    cobrancaExternaCriada: boolean;
}

export interface PaymentCodeDocument {
    _id: ObjectId;
    edicaoId: string;
    codigoNormalizado: string;
    codigo: string;
    tipo: PaymentCodeType;
    percentualDesconto?: number;
    responsavel?: PaymentCodeOwner;
    status: PaymentCodeStatus;
    reserva?: PaymentCodeReservation;
    validoDe?: Date;
    validoAte?: Date;
    usedAt?: Date;
    usedPurchaseId?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: ObjectId | string;
}

export interface PaymentCodeSnapshot {
    codigoId: ObjectId;
    codigo: string;
    codigoNormalizado: string;
    tipo: PaymentCodeType;
    percentualDesconto?: number;
    responsavel?: PaymentCodeOwner;
}

export interface PaymentAmountsByMethod {
    PIX: number;
    BOLETO: number;
    DEBIT_CARD: number;
    CREDIT_CARD: number;
}

export interface PaymentAmountsSnapshot {
    original: PaymentAmountsByMethod;
    desconto: PaymentAmountsByMethod;
    final: PaymentAmountsByMethod;
}

export interface PaymentCodePreview {
    edicaoId: string;
    codigos: {
        desconto?: PaymentCodeSnapshot;
        rastreio?: PaymentCodeSnapshot;
    };
    lote: {
        original: ILoteAutomatico;
        final: ILoteAutomatico;
    };
    valoresCentavos: PaymentAmountsSnapshot;
}

export interface PaymentAssignmentDocument {
    _id?: ObjectId;
    compraId: ObjectId;
    edicaoId: string;
    usuarioId: ObjectId;
    codigoDesconto?: PaymentCodeSnapshot;
    codigoRastreio?: PaymentCodeSnapshot;
    valoresCentavos: PaymentAmountsSnapshot;
    valorSelecionadoCentavos?: {
        original: number;
        desconto: number;
        final: number;
    };
    status: PaymentAssignmentStatus;
    pagamento?: {
        metodo?: string;
        checkoutId?: string;
        paymentId?: string;
        invoiceNumber?: string;
    };
    createdAt: Date;
    confirmedAt?: Date;
    updatedAt: Date;
}
