'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, CreditCard, FileText, Landmark, Loader2, QrCode } from 'lucide-react';
import type { ILoteAutomatico, IPaymentConfig } from '@/lib/types/payments/payment.t';
import type { IPayment } from '@/app/lib/types/payments/payment.t';
import type { PaymentAmountsByMethod, PaymentAmountsSnapshot } from '@/lib/types/payments/paymentCode.t';
import type PaymentTicketProps from '@/lib/types/payments/paymentTicket.t';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';
import TermModal, { type ModalProps } from '@/components/TermModal';
import {
  AsyncStatePanel,
  Badge,
  Button,
  ButtonLink,
  FormField,
  Modal,
  PageShell,
  SectionHeading,
  StatusBanner,
} from '@/components/cieps';

type PaymentMethod = IPaymentConfig['pagamentosAceitos'][number];
type PaymentEntry = IPayment['lista_pagamentos'][number];

type PaymentCodesPreview = {
  codigos: {
    desconto?: {
      codigo: string;
      percentualDesconto: number;
    };
    rastreio?: {
      codigo: string;
    };
  };
  lote: {
    original: ILoteAutomatico;
    final: ILoteAutomatico;
  };
  valoresCentavos: PaymentAmountsSnapshot;
};

type PersonalInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement: string;
  phone: string;
};

type CardInfo = {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
  focus: '';
};

const emptyPersonalInfo: PersonalInfo = {
  name: '',
  email: '',
  cpfCnpj: '',
  postalCode: '',
  addressNumber: '',
  addressComplement: '',
  phone: '',
};

const emptyCardInfo: CardInfo = {
  number: '',
  expiry: '',
  cvc: '',
  name: '',
  focus: '',
};

const methodLabels: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Crédito à vista',
  DEBIT_CARD: 'Débito',
};

const methodIcons: Record<PaymentMethod, typeof QrCode> = {
  PIX: QrCode,
  BOLETO: FileText,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: Landmark,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCurrencyFromCents(value: number) {
  return formatCurrency(value / 100);
}

function normalizePaymentCode(value: string) {
  return value.trim().toLocaleUpperCase('pt-BR');
}

function PaymentAmountsSummary({
  amounts,
  methods,
}: {
  amounts: PaymentAmountsSnapshot;
  methods: (keyof PaymentAmountsByMethod)[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Valores original e final por forma de pagamento">
      {methods.map((method) => {
        const discount = amounts.desconto[method];
        return (
          <div key={method} className="rounded-md border border-linha bg-white p-3 text-sm">
            <p className="font-bold text-tinta">{methodLabels[method]}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-muted">
              <span>Original</span>
              <span className={discount > 0 ? 'line-through' : ''}>{formatCurrencyFromCents(amounts.original[method])}</span>
            </div>
            {discount > 0 && (
              <div className="mt-1 flex items-center justify-between gap-3 font-semibold text-[#2f7651]">
                <span>Desconto</span>
                <span>- {formatCurrencyFromCents(discount)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-linha pt-2 font-bold text-tinta">
              <span>Final</span>
              <span>{formatCurrencyFromCents(amounts.final[method])}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function friendlyStatus(status: string) {
  const statuses: Record<string, string> = {
    PAYMENT_CONFIRMED: 'Pago',
    CONFIRMED: 'Pago',
    PAYMENT_RECEIVED: 'Pago',
    RECEIVED: 'Pago',
    PENDING: 'Pagamento pendente',
    PAYMENT_OVERDUE: 'Expirado',
    PAYMENT_REFUNDED: 'Estornado',
    PAYMENT_REFUND_IN_PROGRESS: 'Estorno em processamento',
    PAYMENT_REFUND_DENIED: 'Estorno negado',
  };
  return statuses[status] ?? status.replaceAll('_', ' ').toLocaleLowerCase('pt-BR');
}

function isConfigActive(config: IPaymentConfig) {
  const start = paymentBoundaryTimestamp(config.dataInit, false);
  const end = paymentBoundaryTimestamp(config.dataEnd, true);
  const now = Date.now();
  return (!Number.isFinite(start) || now >= start) && (!Number.isFinite(end) || now <= end);
}

function paymentBoundaryTimestamp(value: string, endOfDay: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    return Date.parse(`${value}T${time}-03:00`);
  }
  return new Date(value).getTime();
}

export default function PagamentosManual({
  initialPayment,
  config,
  onRefresh,
  defaultEmail,
}: {
  initialPayment: IPayment;
  config: IPaymentConfig & {
    sessaoPagamentoAutomáticoAtiva?: PaymentTicketProps | false;
  };
  onRefresh: () => void;
  defaultEmail: string;
}) {
  const router = useRouter();
  const requestInFlight = useRef(false);
  const cardRequestInFlight = useRef(false);
  const [payment] = useState(initialPayment);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardStep, setCardStep] = useState<1 | 2>(1);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    ...emptyPersonalInfo,
    email: defaultEmail,
  });
  const [cardInfo, setCardInfo] = useState<CardInfo>(emptyCardInfo);
  const [selectedInstallment, setSelectedInstallment] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [codigoDesconto, setCodigoDesconto] = useState('');
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [codesPreview, setCodesPreview] = useState<PaymentCodesPreview | null>(null);
  const [codesMessage, setCodesMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [isPreviewingCodes, setIsPreviewingCodes] = useState(false);
  const [terms, setTerms] = useState<ModalProps>({
    isOpen: false,
    onClose: () => setTerms((current) => ({ ...current, isOpen: false })),
    onConfirm: () => undefined,
  });

  const pendingPayments = payment.lista_pagamentos.filter((item) => item.status === 'PENDING');
  const activeSession = config.sessaoPagamentoAutomáticoAtiva || null;
  const recoveredSessionLink = activeSession?.paymentUrl || null;
  const active = isConfigActive(config);
  const hasInformedCodes = Boolean(normalizePaymentCode(codigoDesconto) || normalizePaymentCode(codigoRastreio));
  const displayedInstallments = codesPreview?.lote.final.precos.parcelamentos ?? config.parcelamentos;

  const resetCodesPreview = () => {
    setCodesPreview(null);
    setCodesMessage(null);
  };

  const clearCodes = () => {
    setCodigoDesconto('');
    setCodigoRastreio('');
    resetCodesPreview();
  };

  const handlePreviewCodes = async () => {
    const normalizedDiscountCode = normalizePaymentCode(codigoDesconto);
    const normalizedTrackingCode = normalizePaymentCode(codigoRastreio);

    if (!normalizedDiscountCode && !normalizedTrackingCode) {
      setCodesPreview(null);
      setCodesMessage({ tone: 'error', text: 'Informe um código de desconto ou de rastreio.' });
      return;
    }

    setIsPreviewingCodes(true);
    setCodesMessage(null);
    try {
      const response = await fetchWithTimeout('/api/payment/codes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigoDesconto: normalizedDiscountCode,
          codigoRastreio: normalizedTrackingCode,
          modo: 'manual',
          loteCodigo: 0,
        }),
      }, 15_000);
      const result = (await response.json().catch(() => ({}))) as Partial<PaymentCodesPreview> & {
        message?: string;
      };

      if (!response.ok || !result.codigos || !result.lote || !result.valoresCentavos) {
        throw new Error(result.message || 'Não foi possível validar os códigos informados.');
      }

      const preview = result as PaymentCodesPreview;
      setCodesPreview(preview);
      if (preview.codigos.desconto) setCodigoDesconto(preview.codigos.desconto.codigo);
      if (preview.codigos.rastreio) setCodigoRastreio(preview.codigos.rastreio.codigo);
      setCodesMessage({
        tone: 'success',
        text: preview.codigos.desconto
          ? `Desconto de ${preview.codigos.desconto.percentualDesconto}% aplicado ao resumo.`
          : 'Código de rastreio reconhecido. O valor da inscrição não foi alterado.',
      });
    } catch (error) {
      setCodesPreview(null);
      setCodesMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível validar os códigos informados.',
      });
    } finally {
      setIsPreviewingCodes(false);
    }
  };

  const codesAreReady = () => {
    if (!hasInformedCodes || codesPreview) return true;
    setCodesMessage({ tone: 'error', text: 'Valide os códigos informados antes de criar a cobrança.' });
    return false;
  };

  const closeCardForm = (force = false) => {
    if (cardRequestInFlight.current && !force) return;
    setCardOpen(false);
    setCardStep(1);
    setCardInfo(emptyCardInfo);
    setSelectedInstallment(null);
    setFormError(null);
  };

  const createPayment = async () => {
    if (!selectedMethod || requestInFlight.current) return;
    const payerError = validateCustomerInfo();
    setFormError(payerError);
    if (payerError) return;
    if (!codesAreReady()) {
      setSelectedMethod(null);
      setMessage({ tone: 'error', text: 'Valide os códigos informados antes de criar a cobrança.' });
      return;
    }
    requestInFlight.current = true;
    setCreatingPayment(true);
    setMessage(null);

    try {
      const response = await fetchWithTimeout('/api/payment/create_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typePayment: selectedMethod,
          payer: {
            name: personalInfo.name,
            cpfCnpj: personalInfo.cpfCnpj,
            postalCode: personalInfo.postalCode,
            addressNumber: personalInfo.addressNumber,
            complement: personalInfo.addressComplement,
          },
          codigoDesconto: normalizePaymentCode(codigoDesconto) || null,
          codigoRastreio: normalizePaymentCode(codigoRastreio) || null,
        }),
      });
      const result = (await response.json().catch(() => null)) as { link?: string; message?: string } | null;
      if (!response.ok || !result?.link) {
        throw new Error(result?.message ?? 'Não foi possível criar a cobrança.');
      }
      setSelectedMethod(null);
      router.push(result.link);
    } catch (error) {
      setSelectedMethod(null);
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível criar a cobrança.',
      });
    } finally {
      requestInFlight.current = false;
      setCreatingPayment(false);
    }
  };

  const validateCustomerInfo = () => {
    if (personalInfo.name.trim().length < 5) return 'Informe o nome completo do pagador.';
    if (personalInfo.cpfCnpj.replace(/\D/g, '').length !== 11) return 'Informe um CPF válido.';
    if (personalInfo.postalCode.replace(/\D/g, '').length !== 8) return 'Informe um CEP válido.';
    if (!personalInfo.addressNumber.trim()) return 'Informe o número do endereço.';
    return null;
  };

  const validatePersonalInfo = () => {
    const payerError = validateCustomerInfo();
    if (payerError) return payerError;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) return 'Informe um e-mail válido.';
    if (personalInfo.cpfCnpj.replace(/\D/g, '').length < 11) return 'Informe um CPF válido.';
    if (personalInfo.postalCode.replace(/\D/g, '').length !== 8) return 'Informe um CEP válido.';
    if (!personalInfo.addressNumber.trim()) return 'Informe o número do endereço.';
    if (personalInfo.phone.replace(/\D/g, '').length < 10) return 'Informe um telefone válido.';
    return null;
  };

  const advanceCardForm = () => {
    const error = validatePersonalInfo();
    setFormError(error);
    if (!error) setCardStep(2);
  };

  const submitCard = () => {
    if (cardInfo.number.replace(/\D/g, '').length < 13) return setFormError('Informe um número de cartão válido.');
    if (!cardInfo.name.trim()) return setFormError('Informe o nome impresso no cartão.');
    if (!/^\d{2}\/\d{2}$/.test(cardInfo.expiry)) return setFormError('Informe a validade no formato MM/AA.');
    if (cardInfo.cvc.replace(/\D/g, '').length < 3) return setFormError('Informe o código de segurança.');
    if (selectedInstallment === null) return setFormError('Escolha uma opção de parcelamento.');

    setFormError(null);
    setTerms((current) => ({
      ...current,
      isOpen: true,
      onConfirm: processCardPayment,
    }));
  };

  const processCardPayment = async () => {
    if (selectedInstallment === null || cardRequestInFlight.current) return;
    if (!codesAreReady()) {
      closeCardForm(true);
      setMessage({ tone: 'error', text: 'Valide os códigos informados antes de processar o cartão.' });
      return;
    }
    cardRequestInFlight.current = true;
    setTerms((current) => ({ ...current, isOpen: false }));
    setCreatingPayment(true);
    setMessage(null);

    try {
      const response = await fetchWithTimeout('/api/payment/createCreditCardPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo,
          payer: {
            name: personalInfo.name,
            cpfCnpj: personalInfo.cpfCnpj,
            postalCode: personalInfo.postalCode,
            addressNumber: personalInfo.addressNumber,
            complement: personalInfo.addressComplement,
          },
          cardInfo,
          idPagamento: selectedInstallment,
          _id: config._id,
          codigoDesconto: normalizePaymentCode(codigoDesconto) || null,
          codigoRastreio: normalizePaymentCode(codigoRastreio) || null,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? 'Não foi possível processar o pagamento.');
      closeCardForm(true);
      setMessage({ tone: 'success', text: result?.message ?? 'Pagamento enviado para processamento.' });
      onRefresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Não foi possível processar o pagamento.';
      setMessage({
        tone: 'error',
        text: text.includes('endereço do titular') ? 'Informe um CEP válido.' : text,
      });
    } finally {
      cardRequestInFlight.current = false;
      setCreatingPayment(false);
    }
  };

  return (
    <PageShell>
      <SectionHeading
        kicker="Área do congressista"
        title="Meus pagamentos"
        description="Acompanhe suas cobranças e escolha uma forma de pagamento disponível."
      />

      <div className="mx-auto mt-8 flex w-full max-w-5xl flex-col gap-6">
        {message && (
          <StatusBanner
            tone={message.tone}
            title={message.tone === 'success' ? 'Solicitação concluída' : 'Não foi possível concluir'}
            action={message.tone === 'error' ? <Button variant="ghost" onClick={() => setMessage(null)}>Fechar</Button> : undefined}
          >
            {message.text}
          </StatusBanner>
        )}

        <StatusBanner
          tone={payment.situacao === 1 ? 'success' : 'warning'}
          title={payment.situacao === 1 ? 'Pagamento confirmado' : 'Pagamento pendente'}
        >
          {payment.situacao === 1
            ? 'Seu acesso às funcionalidades do CIEPS está liberado.'
            : 'Conclua uma cobrança em aberto ou crie um novo pagamento.'}
        </StatusBanner>

        {(pendingPayments.length > 0 || recoveredSessionLink) && (
          <section className="cieps-surface p-5 sm:p-7" aria-labelledby="pending-payments-title">
            <h2 id="pending-payments-title" className="cieps-display text-2xl font-semibold text-tinta">Cobranças em aberto</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Continue uma cobrança existente para evitar pagamentos duplicados.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {pendingPayments.map((item) => (
                <ButtonLink key={item._id} href={item.invoiceUrl} target="_blank" variant="outline" full>
                  {methodLabels[item.billingType as PaymentMethod] ?? item.billingType}
                  <ArrowRight size={17} aria-hidden="true" />
                </ButtonLink>
              ))}
              {recoveredSessionLink &&
                !pendingPayments.some((item) => item.invoiceUrl === recoveredSessionLink) && (
                  <ButtonLink href={recoveredSessionLink} target="_blank" variant="outline" full>
                    Continuar cobrança recuperada
                    <ArrowRight size={17} aria-hidden="true" />
                  </ButtonLink>
                )}
            </div>
          </section>
        )}

        {activeSession && !recoveredSessionLink && (
          <StatusBanner tone="warning" title="Cobrança em verificação">
            O resultado da criação está sendo conciliado. Não tente gerar outra cobrança agora.
          </StatusBanner>
        )}

        <section className="cieps-surface p-5 sm:p-7" aria-labelledby="new-payment-title">
          <h2 id="new-payment-title" className="cieps-display text-2xl font-semibold text-tinta">Novo pagamento</h2>
          {activeSession ? (
            <AsyncStatePanel
              status="empty"
              emptyTitle="Já existe uma cobrança ativa"
              message="Conclua a cobrança acima ou aguarde a verificação antes de iniciar outra."
              className="mt-5"
            />
          ) : !active ? (
            <AsyncStatePanel
              status="empty"
              emptyTitle="Inscrições encerradas"
              message="Não é possível criar uma nova cobrança neste momento. Cobranças já emitidas continuam disponíveis acima."
              className="mt-5"
            />
          ) : config.pagamentosAceitos.length === 0 ? (
            <AsyncStatePanel status="empty" emptyTitle="Nenhuma forma de pagamento disponível" className="mt-5" />
          ) : (
            <div className="mt-5">
              <section className="rounded-md border border-linha bg-papel p-4 sm:p-5" aria-labelledby="manual-payment-codes-title">
                <div>
                  <h3 id="manual-payment-codes-title" className="text-base font-bold text-tinta">Possui algum código?</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">O desconto reduz o valor. O rastreio registra a indicação sem alterar o preço.</p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="manual-discount-code" className="mb-1 block text-sm font-semibold text-tinta">Código de desconto</label>
                    <input
                      id="manual-discount-code"
                      type="text"
                      value={codigoDesconto}
                      maxLength={64}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Ex.: C26-H7K9-Q2PX"
                      onChange={(event) => {
                        setCodigoDesconto(event.target.value.toLocaleUpperCase('pt-BR'));
                        resetCodesPreview();
                      }}
                      className="w-full rounded-md border border-linha bg-white p-3 font-mono text-sm uppercase text-tinta outline-none transition focus:border-goles focus:ring-1 focus:ring-goles"
                    />
                  </div>
                  <div>
                    <label htmlFor="manual-tracking-code" className="mb-1 block text-sm font-semibold text-tinta">Código de rastreio</label>
                    <input
                      id="manual-tracking-code"
                      type="text"
                      value={codigoRastreio}
                      maxLength={64}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Ex.: C26-PARCEIRO-ANA"
                      onChange={(event) => {
                        setCodigoRastreio(event.target.value.toLocaleUpperCase('pt-BR'));
                        resetCodesPreview();
                      }}
                      className="w-full rounded-md border border-linha bg-white p-3 font-mono text-sm uppercase text-tinta outline-none transition focus:border-goles focus:ring-1 focus:ring-goles"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handlePreviewCodes()}
                    disabled={isPreviewingCodes || !hasInformedCodes}
                    aria-busy={isPreviewingCodes}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-goles px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#8f2323] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreviewingCodes && <Loader2 className="animate-spin" size={17} aria-hidden="true" />}
                    {isPreviewingCodes ? 'Validando...' : 'Aplicar códigos'}
                  </button>
                  {(hasInformedCodes || codesPreview) && (
                    <button
                      type="button"
                      onClick={clearCodes}
                      disabled={isPreviewingCodes}
                      className="rounded-md border border-linha bg-white px-5 py-2.5 text-sm font-semibold text-muted transition hover:border-goles/40 hover:text-tinta disabled:opacity-60"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {codesMessage && (
                  <div
                    className={`mt-4 rounded-md border p-3 text-sm ${codesMessage.tone === 'success' ? 'border-[#2f7651]/30 bg-[#2f7651]/10 text-[#245f41]' : 'border-red-200 bg-red-50 text-red-700'}`}
                    role={codesMessage.tone === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                  >
                    {codesMessage.text}
                  </div>
                )}

                {codesPreview && (
                  <div className="mt-4 rounded-md border border-[#2f7651]/25 bg-white p-4" aria-label="Prévia dos códigos aplicados">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {codesPreview.codigos.desconto && (
                        <span className="rounded-full bg-[#2f7651]/10 px-3 py-1 text-[#245f41]">
                          {codesPreview.codigos.desconto.codigo} · {codesPreview.codigos.desconto.percentualDesconto}% de desconto
                        </span>
                      )}
                      {codesPreview.codigos.rastreio && (
                        <span className="rounded-full bg-goles/10 px-3 py-1 text-goles">Rastreio {codesPreview.codigos.rastreio.codigo}</span>
                      )}
                    </div>
                    <div className="mt-4">
                      <PaymentAmountsSummary amounts={codesPreview.valoresCentavos} methods={config.pagamentosAceitos} />
                    </div>
                  </div>
                )}
              </section>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {config.pagamentosAceitos.map((method) => {
                  const Icon = methodIcons[method];
                  return (
                    <Button key={method} variant="outline" full onClick={() => setSelectedMethod(method)}>
                      <Icon size={18} aria-hidden="true" />
                      {methodLabels[method]}
                    </Button>
                  );
                })}
                {displayedInstallments.length > 0 && (
                  <Button
                    full
                    onClick={() => {
                      if (!codesAreReady()) {
                        setMessage({ tone: 'error', text: 'Valide os códigos informados antes de preencher o cartão.' });
                        return;
                      }
                      setCardOpen(true);
                    }}
                  >
                    <CreditCard size={18} aria-hidden="true" />
                    Pagar parcelado
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="cieps-surface p-5 sm:p-7" aria-labelledby="payment-history-title">
          <h2 id="payment-history-title" className="cieps-display text-2xl font-semibold text-tinta">Histórico de pagamentos</h2>
          {payment.lista_pagamentos.length === 0 ? (
            <AsyncStatePanel status="empty" emptyTitle="Nenhum pagamento encontrado" className="mt-5" />
          ) : (
            <div className="mt-5 grid gap-4">
              {payment.lista_pagamentos.map((item) => <PaymentHistoryCard key={item._id} item={item} />)}
            </div>
          )}
        </section>
      </div>

      <Modal
        open={selectedMethod !== null}
        onClose={() => {
          if (creatingPayment) return;
          setSelectedMethod(null);
          setFormError(null);
        }}
        title="Criar nova cobrança?"
        description={selectedMethod ? `Forma de pagamento: ${methodLabels[selectedMethod]}.` : undefined}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSelectedMethod(null)} disabled={creatingPayment}>Cancelar</Button>
            <Button onClick={createPayment} loading={creatingPayment}>Criar cobrança</Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-muted">Informe somente os dados necessários para vincular a cobrança ao seu cadastro.</p>
        {formError && <StatusBanner className="mt-4" tone="error" title="Revise os dados">{formError}</StatusBanner>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField id="manual-customer-name" label="Nome completo" value={personalInfo.name} autoComplete="name" onChange={(value) => setPersonalInfo((current) => ({ ...current, name: value }))} />
          <TextField id="manual-customer-cpf" label="CPF" value={personalInfo.cpfCnpj} inputMode="numeric" onChange={(value) => setPersonalInfo((current) => ({ ...current, cpfCnpj: value.replace(/\D/g, '').slice(0, 11) }))} />
          <TextField id="manual-customer-zip" label="CEP" value={personalInfo.postalCode} inputMode="numeric" autoComplete="postal-code" onChange={(value) => setPersonalInfo((current) => ({ ...current, postalCode: value.replace(/\D/g, '').slice(0, 8) }))} />
          <TextField id="manual-customer-number" label="Número do endereço" value={personalInfo.addressNumber} autoComplete="address-line2" onChange={(value) => setPersonalInfo((current) => ({ ...current, addressNumber: value }))} />
          <div className="sm:col-span-2">
            <TextField id="manual-customer-complement" label="Complemento (opcional)" value={personalInfo.addressComplement} autoComplete="address-line2" onChange={(value) => setPersonalInfo((current) => ({ ...current, addressComplement: value }))} />
          </div>
        </div>
        {codesPreview && selectedMethod && (
          <div className="mt-4 rounded-md bg-papel p-3">
            <PaymentAmountsSummary amounts={codesPreview.valoresCentavos} methods={[selectedMethod]} />
          </div>
        )}
      </Modal>

      <Modal
        open={cardOpen && !terms.isOpen && !creatingPayment}
        onClose={closeCardForm}
        title="Pagamento parcelado"
        description={cardStep === 1 ? 'Informe os dados do titular.' : 'Informe os dados do cartão e escolha o parcelamento.'}
        className="max-w-2xl"
        footer={cardStep === 1 ? (
          <Button onClick={advanceCardForm}>Continuar</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setCardStep(1)}>Voltar</Button>
            <Button onClick={submitCard}>Revisar pagamento</Button>
          </>
        )}
      >
        {formError && <StatusBanner tone="error" title="Revise os dados">{formError}</StatusBanner>}
        {codesPreview && (
          <div className="mt-4 rounded-md bg-papel p-3">
            <PaymentAmountsSummary amounts={codesPreview.valoresCentavos} methods={['CREDIT_CARD']} />
          </div>
        )}
        {cardStep === 1 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField id="manual-payer-name" label="Nome completo" value={personalInfo.name} autoComplete="name" onChange={(value) => setPersonalInfo((current) => ({ ...current, name: value }))} />
            <TextField id="manual-payer-email" label="E-mail" type="email" value={personalInfo.email} autoComplete="email" onChange={(value) => setPersonalInfo((current) => ({ ...current, email: value }))} />
            <TextField id="manual-payer-cpf" label="CPF" value={personalInfo.cpfCnpj} inputMode="numeric" onChange={(value) => setPersonalInfo((current) => ({ ...current, cpfCnpj: value.replace(/\D/g, '').slice(0, 14) }))} />
            <TextField id="manual-payer-phone" label="Telefone" value={personalInfo.phone} inputMode="tel" autoComplete="tel" onChange={(value) => setPersonalInfo((current) => ({ ...current, phone: value }))} />
            <TextField id="manual-payer-zip" label="CEP" value={personalInfo.postalCode} inputMode="numeric" autoComplete="postal-code" onChange={(value) => setPersonalInfo((current) => ({ ...current, postalCode: value.replace(/\D/g, '').slice(0, 8) }))} />
            <TextField id="manual-payer-number" label="Número do endereço" value={personalInfo.addressNumber} autoComplete="address-line2" onChange={(value) => setPersonalInfo((current) => ({ ...current, addressNumber: value }))} />
            <TextField id="manual-payer-complement" label="Complemento (opcional)" value={personalInfo.addressComplement} autoComplete="address-line2" onChange={(value) => setPersonalInfo((current) => ({ ...current, addressComplement: value }))} />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField id="manual-card-number" label="Número do cartão" value={cardInfo.number} inputMode="numeric" autoComplete="cc-number" onChange={(value) => setCardInfo((current) => ({ ...current, number: value.replace(/\D/g, '').slice(0, 19) }))} />
            <TextField id="manual-card-name" label="Nome no cartão" value={cardInfo.name} autoComplete="cc-name" onChange={(value) => setCardInfo((current) => ({ ...current, name: value }))} />
            <TextField id="manual-card-expiry" label="Validade (MM/AA)" value={cardInfo.expiry} inputMode="numeric" autoComplete="cc-exp" onChange={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, 4);
              setCardInfo((current) => ({ ...current, expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits }));
            }} />
            <TextField id="manual-card-cvc" label="Código de segurança" value={cardInfo.cvc} inputMode="numeric" autoComplete="cc-csc" onChange={(value) => setCardInfo((current) => ({ ...current, cvc: value.replace(/\D/g, '').slice(0, 4) }))} />
            <fieldset className="sm:col-span-2">
              <legend className="mb-3 text-sm font-bold text-tinta">Opções de parcelamento</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {displayedInstallments.map((installment) => (
                  <button
                    key={installment.codigo}
                    type="button"
                    aria-pressed={selectedInstallment === installment.codigo}
                    onClick={() => setSelectedInstallment(installment.codigo)}
                    className={`min-h-12 rounded-md border p-4 text-left text-sm transition-colors ${selectedInstallment === installment.codigo ? 'border-goles bg-goles/10 text-tinta' : 'border-linha bg-white text-muted hover:border-goles/50'}`}
                  >
                    <strong className="block text-tinta">{installment.totalParcelas}x de {formatCurrency(installment.valorCadaParcela)}</strong>
                    Total de {formatCurrency(installment.totalParcelas * installment.valorCadaParcela)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </Modal>

      <Modal open={creatingPayment && cardOpen} onClose={() => undefined} title="Processando pagamento">
        <AsyncStatePanel status="loading" loadingTitle="Enviando dados com segurança" />
      </Modal>
      <TermModal {...terms} />
    </PageShell>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  return (
    <FormField htmlFor={id} label={label} required>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required
      />
    </FormField>
  );
}

function PaymentHistoryCard({ item }: { item: PaymentEntry }) {
  const canOpen = item.status !== 'PAYMENT_OVERDUE' && Boolean(item.invoiceUrl);
  return (
    <article className="rounded-lg border border-linha bg-papel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-lg text-tinta">{formatCurrency(item.value)}</strong>
            <Badge>{friendlyStatus(item.status)}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{item.description || 'Pagamento da inscrição CIEPS'}</p>
          <p className="mt-1 text-xs text-muted">{formatDate(item.dateCreated)} · cobrança #{item.invoiceNumber}</p>
        </div>
        {canOpen && (
          <ButtonLink href={item.invoiceUrl} target="_blank" variant="ghost">
            Ver cobrança <ArrowRight size={16} aria-hidden="true" />
          </ButtonLink>
        )}
      </div>
      {friendlyStatus(item.status) === 'Pago' && (
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#2f7651]">
          <CheckCircle2 size={16} aria-hidden="true" /> Pagamento confirmado
        </div>
      )}
    </article>
  );
}
