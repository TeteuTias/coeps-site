'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import {
  AsyncStatePanel,
  Button,
  ButtonLink,
  ComprovantePagamento,
  PageShell,
  SectionHeading,
  StatusBanner,
} from '@/components/cieps';
import type { ComprovantePagamentoData } from '@/components/cieps/ComprovantePagamento';
import { describePaymentStatus } from '@/lib/payments/receipt-status';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';

type PaymentRecord = ComprovantePagamentoData & {
  invoiceUrl?: string;
  checkoutId?: string;
  _id?: string;
};

type LoadedReceipt = {
  payment: PaymentRecord;
  payerName: string | null;
};

/** Todos os identificadores pelos quais uma cobrança pode ser referenciada na URL. */
function paymentMatches(payment: PaymentRecord, id: string) {
  return [payment.id, payment.invoiceNumber, payment.checkoutId, payment._id]
    .filter(Boolean)
    .some((candidate) => String(candidate) === id);
}

async function requestPayerName(): Promise<string | null> {
  try {
    const response = await fetchWithTimeout('/api/get/usuariosInformacoes', { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await readJsonResponse<{
      data?: { informacoes_usuario?: { nome?: string } };
    }>(response);
    const name = payload?.data?.informacoes_usuario?.nome;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    // O nome é complementar: sem ele o comprovante continua válido.
    return null;
  }
}

async function requestReceipt(id: string): Promise<LoadedReceipt> {
  const response = await fetchWithTimeout('/api/get/usuariosPagamentos', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Não foi possível consultar seus pagamentos. Tente novamente em instantes.');
  }

  const payload = await readJsonResponse<{
    data?: { pagamento?: { lista_pagamentos?: PaymentRecord[] } };
  }>(response);

  const payments = payload?.data?.pagamento?.lista_pagamentos ?? [];
  const payment = payments.find((item) => paymentMatches(item, id));
  if (!payment) {
    throw new Error('Não encontramos esse pagamento na sua conta.');
  }

  return { payment, payerName: await requestPayerName() };
}

export default function ComprovanteDePagamento() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ''));

  const [receipt, setReceipt] = useState<LoadedReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('Pagamento não informado.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReceipt(await requestReceipt(id));
    } catch (requestError) {
      setReceipt(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar o comprovante.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await requestReceipt(id);
        if (active) setReceipt(loaded);
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Não foi possível carregar o comprovante.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const handleDownloadPdf = async () => {
    const element = document.getElementById('comprovante-pagamento');
    if (!element || generating) return;

    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10] as [number, number, number, number],
          filename: `comprovante-pagamento-cieps-${receipt?.payment.invoiceNumber || id}.pdf`,
          image: { type: 'png' as const, quality: 1 },
          html2canvas: { scale: 2, logging: false, dpi: 192, letterRendering: true },
          jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
        })
        .from(element)
        .save();
    } finally {
      setGenerating(false);
    }
  };

  const status = receipt ? describePaymentStatus(receipt.payment.status) : null;

  return (
    <PageShell>
      <SectionHeading
        kicker="Documento do congressista"
        title="Comprovante de pagamento"
        description="Confira os dados da cobrança e gere uma cópia em PDF para seus registros."
        action={
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/pagamentos" variant="outline">
              <ArrowLeft size={18} aria-hidden="true" />
              Voltar
            </ButtonLink>
            <Button onClick={handleDownloadPdf} disabled={!receipt} loading={generating}>
              <Download size={18} aria-hidden="true" />
              {generating ? 'Gerando PDF' : 'Baixar em PDF'}
            </Button>
          </div>
        }
      />

      {loading ? (
        <AsyncStatePanel status="loading" loadingTitle="Preparando seu comprovante" />
      ) : error ? (
        <AsyncStatePanel
          status="error"
          errorTitle="Comprovante indisponível"
          message={error}
          onRetry={load}
        />
      ) : receipt ? (
        <div className="flex flex-col gap-5">
          {status && !status.settled && (
            <StatusBanner tone={status.tone} title={`Situação: ${status.label}`}>
              {status.description} Este documento registra a cobrança, mas ainda não comprova a
              quitação da inscrição.
            </StatusBanner>
          )}

          <ComprovantePagamento payment={receipt.payment} payerName={receipt.payerName} />

          {receipt.payment.invoiceUrl && (
            <div>
              <ButtonLink
                href={receipt.payment.invoiceUrl}
                variant="ghost"
                target="_blank"
                className="px-0"
              >
                Ver fatura oficial na operadora
                <ExternalLink size={16} aria-hidden="true" />
              </ButtonLink>
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
