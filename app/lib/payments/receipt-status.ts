export type ReceiptTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type ReceiptStatus = {
  label: string;
  tone: ReceiptTone;
  /** Somente pagamentos liquidados valem como comprovante de quitação. */
  settled: boolean;
  description: string;
};

const CONFIRMED = ['PAYMENT_CONFIRMED', 'CONFIRMED', 'PAYMENT_RECEIVED', 'RECEIVED'];

/**
 * Traduz o status técnico do pagamento para o texto exibido no comprovante.
 * Mantém a mesma nomenclatura já usada nos cards da página de pagamentos.
 */
export function describePaymentStatus(rawStatus?: string | null): ReceiptStatus {
  const status = String(rawStatus ?? '').toUpperCase();

  if (CONFIRMED.includes(status)) {
    return {
      label: 'Pago',
      tone: 'success',
      settled: true,
      description: 'Pagamento confirmado pela operadora.',
    };
  }

  switch (status) {
    case 'PAYMENT_OVERDUE':
    case 'OVERDUE':
      return {
        label: 'Cancelado',
        tone: 'error',
        settled: false,
        description: 'A cobrança venceu sem confirmação de pagamento.',
      };
    case 'PAYMENT_DELETED':
      return {
        label: 'Cancelado',
        tone: 'error',
        settled: false,
        description: 'A cobrança foi cancelada.',
      };
    case 'PAYMENT_REFUNDED':
      return {
        label: 'Cobrança estornada',
        tone: 'error',
        settled: false,
        description: 'O valor foi devolvido integralmente.',
      };
    case 'PAYMENT_PARTIALLY_REFUNDED':
      return {
        label: 'Parcialmente estornado',
        tone: 'warning',
        settled: false,
        description: 'Parte do valor foi devolvida.',
      };
    case 'PAYMENT_REFUND_IN_PROGRESS':
      return {
        label: 'Processando estorno',
        tone: 'warning',
        settled: false,
        description: 'O estorno foi solicitado e está em processamento.',
      };
    case 'PAYMENT_REFUND_DENIED':
      return {
        label: 'Estorno negado',
        tone: 'error',
        settled: false,
        description: 'O pedido de estorno foi recusado.',
      };
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
    case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
      return {
        label: 'Em análise financeira',
        tone: 'warning',
        settled: false,
        description: 'A cobrança está em análise junto à operadora.',
      };
    case 'PENDING':
    case '':
      return {
        label: 'Pagamento pendente',
        tone: 'warning',
        settled: false,
        description: 'Ainda não recebemos a confirmação da operadora.',
      };
    default:
      return {
        label: 'Em processamento',
        tone: 'info',
        settled: false,
        description: 'A cobrança ainda está sendo processada.',
      };
  }
}

const BILLING_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto bancário',
  UNDEFINED: 'Não informado',
};

export function describeBillingType(billingType?: string | null): string {
  const key = String(billingType ?? '').trim().toUpperCase();
  if (!key) return 'Não informado';
  return BILLING_LABELS[key] ?? key.replace(/_/g, ' ').toLowerCase();
}

export function formatCurrency(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ 0,00';
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
