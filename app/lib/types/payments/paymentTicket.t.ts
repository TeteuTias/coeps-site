import { ObjectId } from 'bson';
import { ILoteAutomatico } from './payment.t';
import type {
    PaymentAmountsSnapshot,
    PaymentCodeSnapshot,
    PaymentSessionStatus,
} from './paymentCode.t';

export type PaymentSessionMethod = "PIX" | "CREDIT_CARD" | "BOLETO" | "DEBIT_CARD";

export default interface PaymentTicketProps {
    _id: ObjectId | string;
    orderId?: string | null;
    owner: ObjectId | string;
    edicaoId?: string;
    pixCode?: string | null;
    userProps: {
        name: string,
        cpf: number | string,
        zipCode: number | string,
        street?: string,
        number: number | string,
        neighborhood?: string,
        complement?: string,
        phone?: string,
        email: string
    },
    paymentConfig: ILoteAutomatico;
    paymentConfigOriginal?: ILoteAutomatico;
    codigoDesconto?: PaymentCodeSnapshot;
    codigoRastreio?: PaymentCodeSnapshot;
    valoresCentavos?: PaymentAmountsSnapshot;
    metodosPagamentoPermitidos?: string[];
    metodoPagamento?: PaymentSessionMethod | null;
    type: "ticket" | "course";
    status: PaymentSessionStatus;
    paymentUrl?: string | null;
    expiresAt: Date | string;
    checkoutExpiresAt?: Date | string | null;
    previousSessionId?: ObjectId | string;
    paymentMethodSwitch?: {
        target?: "CREDIT_CARD";
        status?: "CANCELLING" | "RETRYABLE" | "REVIEW_REQUIRED" | "PAYMENT_DETECTED" | "COMPLETED";
        replacementSessionId?: ObjectId | string;
        reason?: string;
    };
    purchaseCancellation?: {
        status?: "CANCELLING" | "RETRYABLE" | "REVIEW_REQUIRED" | "PAYMENT_DETECTED" | "COMPLETED";
        reason?: string;
        requestedAt?: Date | string;
        updatedAt?: Date | string;
        completedAt?: Date | string;
        gatewayCancellationConfirmedAt?: Date | string;
    };
}
