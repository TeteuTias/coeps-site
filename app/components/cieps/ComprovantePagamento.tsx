'use client';

import Image from 'next/image';
import { Stripe } from './ui';
import {
  describeBillingType,
  describePaymentStatus,
  formatCurrency,
  formatDateTime,
} from '@/lib/payments/receipt-status';

export type ComprovantePagamentoData = {
  /** Identificador da cobrança na operadora. */
  id: string;
  /** Número da fatura, quando emitida. */
  invoiceNumber?: string;
  description?: string;
  /** Valor em reais. */
  value: number;
  /** Data de criação da cobrança, em ISO. */
  dateCreated?: string;
  /** Status técnico devolvido pela API de pagamentos. */
  status?: string;
  /** Método de pagamento (PIX, CREDIT_CARD, BOLETO...). */
  billingType?: string;
};

const toneClasses = {
  success: 'border-[#2f7651]/35 bg-[#2f7651]/10 text-[#2f7651]',
  warning: 'border-ipe/60 bg-ipe/15 text-tinta',
  error: 'border-goles/35 bg-goles/10 text-goles',
  info: 'border-araguari/35 bg-araguari/10 text-araguari',
  neutral: 'border-linha bg-papel text-muted',
} as const;

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-goles">
        {label}
      </span>
      <span className="font-sans text-[13px] leading-relaxed text-tinta">{value}</span>
    </div>
  );
}

/**
 * Comprovante de pagamento do congressista.
 *
 * O nó com `id="comprovante-pagamento"` é a área capturada na exportação em
 * PDF, então tudo que não deve sair no documento fica fora dele.
 */
export default function ComprovantePagamento({
  payment,
  payerName,
}: {
  payment: ComprovantePagamentoData;
  payerName?: string | null;
}) {
  const status = describePaymentStatus(payment.status);
  const reference = payment.invoiceNumber?.trim() || payment.id;

  return (
    <article
      id="comprovante-pagamento"
      className="overflow-hidden rounded-2xl border border-linha bg-white"
    >
      <header className="flex flex-col gap-4 border-b border-linha px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-9 sm:py-8">
        <div className="flex items-start gap-4">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-papel">
            <Image
              src="/cieps/cieps-mark.png"
              alt=""
              fill
              sizes="48px"
              className="object-contain p-1.5"
            />
          </span>
          <div className="min-w-0">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-goles">
              I CIEPS · Documento financeiro
            </span>
            <h2 className="font-title text-[1.65rem] font-semibold leading-tight text-tinta">
              Comprovante de pagamento
            </h2>
            <Stripe className="mt-2" />
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center self-start rounded-full border px-3 py-1.5 font-sans text-[11px] font-bold uppercase tracking-wide ${toneClasses[status.tone]}`}
        >
          {status.label}
        </span>
      </header>

      {/* Destaque do valor, com o acento amarelo do brandbook. */}
      <section className="flex border-b border-linha">
        <span className="w-1.5 shrink-0 bg-ipe" aria-hidden="true" />
        <div className="flex flex-col gap-1 px-6 py-6 sm:px-9">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-goles">
            Valor
          </span>
          <strong className="font-title text-[2.4rem] font-semibold leading-none text-tinta">
            {formatCurrency(payment.value)}
          </strong>
          <span className="font-sans text-[13px] text-muted">{status.description}</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 py-7 sm:grid-cols-2 sm:px-9">
        <DataRow label="Comprovante nº" value={`#${reference}`} />
        <DataRow label="Data" value={formatDateTime(payment.dateCreated)} />
        <DataRow label="Forma de pagamento" value={describeBillingType(payment.billingType)} />
        <DataRow label="Situação" value={status.label} />
        {payerName && <DataRow label="Pagador" value={payerName} />}
        <div className="sm:col-span-2">
          <DataRow
            label="Descrição"
            value={payment.description?.trim() || 'Inscrição no I CIEPS'}
          />
        </div>
      </section>

      <footer className="border-t border-linha bg-papel px-6 py-5 sm:px-9">
        <p className="font-sans text-[12px] leading-relaxed text-muted">
          I Congresso Internacional de Estudantes e Profissionais da Saúde — Araguari, Minas
          Gerais, de 12 a 15 de novembro de 2026. Realização DADG e IMEPAC Araguari.
        </p>
        <p className="mt-2 font-sans text-[11px] leading-relaxed text-muted">
          Documento gerado eletronicamente pelo site do I CIEPS. Identificador da transação:{' '}
          <span className="font-medium text-tinta">{payment.id}</span>.
        </p>
      </footer>
    </article>
  );
}
