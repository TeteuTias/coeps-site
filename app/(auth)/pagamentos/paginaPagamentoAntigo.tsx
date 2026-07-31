'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, CreditCard, FileText, Landmark, QrCode } from 'lucide-react';
import type { IPaymentConfig } from '@/lib/types/payments/payment.t';
import type { IPayment } from '@/app/lib/types/payments/payment.t';
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

type PersonalInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
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
  const start = new Date(config.dataInit).getTime();
  const end = new Date(config.dataEnd).getTime();
  const now = Date.now();
  return (!Number.isFinite(start) || now >= start) && (!Number.isFinite(end) || now <= end);
}

export default function PagamentosManual({
  initialPayment,
  config,
  onRefresh,
}: {
  initialPayment: IPayment;
  config: IPaymentConfig;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const requestInFlight = useRef(false);
  const cardRequestInFlight = useRef(false);
  const [payment] = useState(initialPayment);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardStep, setCardStep] = useState<1 | 2>(1);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(emptyPersonalInfo);
  const [cardInfo, setCardInfo] = useState<CardInfo>(emptyCardInfo);
  const [selectedInstallment, setSelectedInstallment] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [terms, setTerms] = useState<ModalProps>({
    isOpen: false,
    onClose: () => setTerms((current) => ({ ...current, isOpen: false })),
    onConfirm: () => undefined,
  });

  const pendingPayments = payment.lista_pagamentos.filter((item) => item.status === 'PENDING');
  const active = isConfigActive(config);

  const closeCardForm = (force = false) => {
    if (cardRequestInFlight.current && !force) return;
    setCardOpen(false);
    setCardStep(1);
    setPersonalInfo(emptyPersonalInfo);
    setCardInfo(emptyCardInfo);
    setSelectedInstallment(null);
    setFormError(null);
  };

  const createPayment = async () => {
    if (!selectedMethod || requestInFlight.current) return;
    requestInFlight.current = true;
    setCreatingPayment(true);
    setMessage(null);

    try {
      const response = await fetchWithTimeout('/api/payment/create_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typePayment: selectedMethod }),
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

  const validatePersonalInfo = () => {
    if (personalInfo.name.trim().length < 6) return 'Informe o nome completo do pagador.';
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
    cardRequestInFlight.current = true;
    setTerms((current) => ({ ...current, isOpen: false }));
    setCreatingPayment(true);
    setMessage(null);

    try {
      const response = await fetchWithTimeout('/api/payment/createCreditCardPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalInfo, cardInfo, idPagamento: selectedInstallment, _id: config._id }),
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

        {pendingPayments.length > 0 && (
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
            </div>
          </section>
        )}

        <section className="cieps-surface p-5 sm:p-7" aria-labelledby="new-payment-title">
          <h2 id="new-payment-title" className="cieps-display text-2xl font-semibold text-tinta">Novo pagamento</h2>
          {!active ? (
            <AsyncStatePanel
              status="empty"
              emptyTitle="Inscrições encerradas"
              message="Não é possível criar uma nova cobrança neste momento. Cobranças já emitidas continuam disponíveis acima."
              className="mt-5"
            />
          ) : config.pagamentosAceitos.length === 0 ? (
            <AsyncStatePanel status="empty" emptyTitle="Nenhuma forma de pagamento disponível" className="mt-5" />
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {config.pagamentosAceitos.map((method) => {
                const Icon = methodIcons[method];
                return (
                  <Button key={method} variant="outline" full onClick={() => setSelectedMethod(method)}>
                    <Icon size={18} aria-hidden="true" />
                    {methodLabels[method]}
                  </Button>
                );
              })}
              {config.parcelamentos.length > 0 && (
                <Button full onClick={() => setCardOpen(true)}>
                  <CreditCard size={18} aria-hidden="true" />
                  Pagar parcelado
                </Button>
              )}
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
        onClose={() => !creatingPayment && setSelectedMethod(null)}
        title="Criar nova cobrança?"
        description={selectedMethod ? `Forma de pagamento: ${methodLabels[selectedMethod]}.` : undefined}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setSelectedMethod(null)} disabled={creatingPayment}>Cancelar</Button>
            <Button onClick={createPayment} loading={creatingPayment}>Criar cobrança</Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-muted">Ao continuar, você será direcionado à página segura da cobrança.</p>
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
        {cardStep === 1 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField id="manual-payer-name" label="Nome completo" value={personalInfo.name} autoComplete="name" onChange={(value) => setPersonalInfo((current) => ({ ...current, name: value }))} />
            <TextField id="manual-payer-email" label="E-mail" type="email" value={personalInfo.email} autoComplete="email" onChange={(value) => setPersonalInfo((current) => ({ ...current, email: value }))} />
            <TextField id="manual-payer-cpf" label="CPF" value={personalInfo.cpfCnpj} inputMode="numeric" onChange={(value) => setPersonalInfo((current) => ({ ...current, cpfCnpj: value.replace(/\D/g, '').slice(0, 14) }))} />
            <TextField id="manual-payer-phone" label="Telefone" value={personalInfo.phone} inputMode="tel" autoComplete="tel" onChange={(value) => setPersonalInfo((current) => ({ ...current, phone: value }))} />
            <TextField id="manual-payer-zip" label="CEP" value={personalInfo.postalCode} inputMode="numeric" autoComplete="postal-code" onChange={(value) => setPersonalInfo((current) => ({ ...current, postalCode: value.replace(/\D/g, '').slice(0, 8) }))} />
            <TextField id="manual-payer-number" label="Número do endereço" value={personalInfo.addressNumber} autoComplete="address-line2" onChange={(value) => setPersonalInfo((current) => ({ ...current, addressNumber: value }))} />
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
                {config.parcelamentos.map((installment) => (
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
