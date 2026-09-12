type PaymentHistoryItem = {
  status?: unknown;
  value?: unknown;
  description?: unknown;
};

type ConfirmedPaymentHistoryItem = PaymentHistoryItem & {
  value: number;
};

type PaymentHistoryPayload = {
  data?: {
    pagamento?: {
      situacao?: unknown;
      lista_pagamentos?: unknown;
    };
  };
};

function isPaymentHistoryItem(value: unknown): value is PaymentHistoryItem {
  return Boolean(value && typeof value === 'object');
}

function matchesEdition(payment: PaymentHistoryItem, editionId: string) {
  if (typeof payment.description !== 'string') return false;
  return payment.description.toLocaleUpperCase('pt-BR')
    .includes(editionId.toLocaleUpperCase('pt-BR'));
}

function hasConfirmedValue(
  payment: PaymentHistoryItem,
): payment is ConfirmedPaymentHistoryItem {
  return payment.status === 'PAYMENT_CONFIRMED'
    && typeof payment.value === 'number'
    && Number.isFinite(payment.value)
    && payment.value >= 0;
}

export function getConfirmedPurchaseValue(
  payload: unknown,
  editionId: string,
): number | null {
  const paymentData = (payload as PaymentHistoryPayload)?.data?.pagamento;
  if (paymentData?.situacao !== 1 || !Array.isArray(paymentData.lista_pagamentos)) {
    return null;
  }

  const confirmedPayments = paymentData.lista_pagamentos
    .filter(isPaymentHistoryItem)
    .filter(hasConfirmedValue);

  const purchase = confirmedPayments.find((payment) => matchesEdition(payment, editionId))
    ?? confirmedPayments[0];
  if (!purchase || typeof purchase.value !== 'number') return null;

  return Math.round(purchase.value * 100) / 100;
}
