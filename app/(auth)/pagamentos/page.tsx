'use client'
import PagamentosManual from './paginaPagamentoAntigo';
import 'react-credit-cards-2/dist/es/styles-compiled.css';
import { useUser } from "@/lib/auth0-client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link";
import { useRouter } from 'next/navigation';
import Cards from 'react-credit-cards-2';
import { IUser } from "@/app/lib/types/user/user.t"
import { ILoteAutomatico, IPaymentConfig, IParcelamento } from '@/lib/types/payments/payment.t';
import TermModal, { ModalProps } from '@/components/TermModal';
import { AsyncStatePanel, Button, Modal, PageShell, StatusBanner } from '@/components/cieps';
import {
    Loader2,
    CheckCircle,
    ArrowRight,
    BarChart3,
    Copy,
    QrCode,
    CircleX,
} from 'lucide-react';
import './style.css';
import PaymentTicketProps from '@/lib/types/payments/paymentTicket.t';
import type { PaymentAmountsByMethod, PaymentAmountsSnapshot } from '@/lib/types/payments/paymentCode.t';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';

type PaymentConfigView = IPaymentConfig & {
    sessaoPagamentoAutomáticoAtiva: PaymentTicketProps | false;
    loteAutomaticoAtual?: ILoteAutomatico;
};

type PaymentCodesPreview = {
    codigos: {
        desconto?: {
            codigo: string;
            percentualDesconto: number;
        };
        rastreio?: {
            codigo: string;
            responsavel?: {
                nome: string;
            };
        };
    };
    lote: {
        original: ILoteAutomatico;
        final: ILoteAutomatico;
    };
    valoresCentavos: PaymentAmountsSnapshot;
};

const paymentAmountLabels: Record<keyof PaymentAmountsByMethod, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    DEBIT_CARD: 'Débito',
    CREDIT_CARD: 'Crédito',
};

function formatCurrencyFromCents(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value / 100);
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
        <div className='grid gap-3 sm:grid-cols-2' aria-label="Valores original e final por forma de pagamento">
            {methods.map((method) => {
                const discount = amounts.desconto[method];
                return (
                    <div key={method} className='rounded-lg border border-linha bg-white p-3 text-sm'>
                        <p className='font-bold text-tinta'>{paymentAmountLabels[method]}</p>
                        <div className='mt-2 flex items-center justify-between gap-3 text-muted'>
                            <span>Original</span>
                            <span className={discount > 0 ? 'line-through' : ''}>
                                {formatCurrencyFromCents(amounts.original[method])}
                            </span>
                        </div>
                        {discount > 0 && (
                            <div className='mt-1 flex items-center justify-between gap-3 font-semibold text-[#2f7651]'>
                                <span>Desconto</span>
                                <span>- {formatCurrencyFromCents(discount)}</span>
                            </div>
                        )}
                        <div className='mt-2 flex items-center justify-between gap-3 border-t border-linha pt-2 font-bold text-tinta'>
                            <span>Final</span>
                            <span>{formatCurrencyFromCents(amounts.final[method])}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const Pagamentos = () => {
    const [data, setData] = useState<{ pagamento: IUser["pagamento"] } | undefined>(undefined);
    const { user, isLoading } = useUser();
    const [isLoadingPaymentData, setIsLoadingPaymentData] = useState<boolean>(true);
    const [dataPaymentConfig, setDataPaymentConfig] = useState<PaymentConfigView | undefined>(undefined);
    const [isFetchingData, setIsFetchingData] = useState<boolean>(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [requestVersion, setRequestVersion] = useState(0);
    const handleIsFetchingData = (event: boolean) => {
        setIsFetchingData(event);
    };

    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                const response = await fetchWithTimeout("/api/get/usuariosPagamentos", {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Falha ao enviar a requisição GET');
                }

                const responseData: { data: { pagamento: IUser["pagamento"] } } = await response.json();
                setData(responseData.data)

                handleIsFetchingData(false);
            } catch {
                setPageError('Não foi possível consultar seus pagamentos.');
            } finally {
                handleIsFetchingData(false);
            }
        };

        if (!isLoading) {
            enviarRequisicaoGet();
        }
    }, [isLoading, user, requestVersion]);

    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                const response = await fetchWithTimeout("/api/payment/paymentConfigs", {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Falha ao enviar a requisição GET');
                }

                const responseData: PaymentConfigView = await response.json();
                setDataPaymentConfig(responseData);
            } catch {
                setPageError('Não foi possível consultar as formas de pagamento.');
            } finally {
                setIsLoadingPaymentData(false);
            }
        };
        enviarRequisicaoGet();
    }, [requestVersion]);
    const hidratarPágina = async () => {
        setIsLoadingPaymentData(true);
        try {
            const response = await fetchWithTimeout("/api/payment/paymentConfigs", {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Falha ao enviar a requisição GET');
            }

            const responseData: PaymentConfigView = await response.json();
            setDataPaymentConfig(responseData);
            setPageError(null);
        } catch {
            setPageError('Não foi possível atualizar a sessão de pagamento.');
        } finally {
            setIsLoadingPaymentData(false);
        }
    };

    const retryPage = () => {
        setPageError(null);
        setIsFetchingData(true);
        setIsLoadingPaymentData(true);
        setRequestVersion((version) => version + 1);
    };

    return (
        <div>
            <main className="min-h-screen font-[family-name:var(--cieps-body)] text-[var(--cieps-ink)] pb-12">
                <div className="mx-auto w-full max-w-[1320px] px-[clamp(1rem,3vw,2rem)] pt-[clamp(2rem,4vw,4rem)]">
                    <RegistrationTimer />
                </div>
            </main>
        </div>
    )

    if (isFetchingData || isLoadingPaymentData) {
        return <LoadingScreen />;
    }

    if (pageError || !data || !dataPaymentConfig) {
        return (
            <PageShell className="flex items-center justify-center">
                <AsyncStatePanel
                    status="error"
                    errorTitle="Pagamentos indisponíveis"
                    message={pageError ?? 'Os dados de pagamento retornaram incompletos.'}
                    onRetry={retryPage}
                    className="w-full max-w-2xl"
                />
            </PageShell>
        );
    }

    // return <PagamentosManual />

    if (data.pagamento.situacao === 1) { // Está pago
        return (
            <main className="min-h-screen font-[family-name:var(--cieps-body)] text-[var(--cieps-ink)] pb-12">
                <div className="mx-auto w-full max-w-[1320px] px-[clamp(1rem,3vw,2rem)] pt-[clamp(2rem,4vw,4rem)]">

                    {/* Container de Status */}
                    <div className="mb-6 flex flex-wrap items-center gap-[0.8rem] rounded-lg border border-[var(--cieps-line)] bg-[rgba(255,253,248,.96)] p-[clamp(1.25rem,3vw,2rem)] text-left shadow-[var(--cieps-shadow)]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[rgba(163,45,45,.2)] bg-[rgba(163,45,45,.08)] text-[var(--cieps-red)] shadow-none">
                            <CheckCircle className="h-[1.2rem] w-[1.2rem]" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <h2 className="m-0 font-[family-name:var(--cieps-display)] text-xl font-semibold tracking-normal text-[var(--cieps-ink)] shadow-none">
                                PAGAMENTO CONFIRMADO
                            </h2>
                            <p className="m-0 text-[0.98rem] text-[var(--cieps-muted)]">
                                Seu pagamento foi confirmado! Você tem acesso completo ao CIEPS.
                            </p>
                        </div>
                    </div>

                    {/* Seção de Histórico */}
                    <section className="mx-auto w-full max-w-[1320px] pb-5">
                        <div className="w-full">

                            {/* Cabeçalho replicando o pseudo-elemento ::before */}
                            <span className="mb-[0.65rem] block text-[0.72rem] font-bold text-[var(--cieps-red)]">
                                ÁREA DO CONGRESSISTA
                            </span>
                            <h2 className="mb-5 font-[family-name:var(--cieps-display)] text-[clamp(1.8rem,3vw,2.8rem)] font-semibold leading-none tracking-[-.035em] text-[var(--cieps-ink)] shadow-none">
                                HISTÓRICO DE PAGAMENTOS
                            </h2>

                            {/* Superfície Editorial (Glass Container) */}
                            <div className="rounded-lg border border-[var(--cieps-line)] bg-[rgba(255,253,248,.96)] p-[clamp(1.25rem,4vw,2rem)] shadow-[var(--cieps-shadow)]">

                                <p className="mb-6 text-[0.96rem] leading-[1.65] text-[var(--cieps-muted)]">
                                    Acompanhe todos os seus pagamentos realizados e mantenha o controle das suas transações.
                                </p>

                                {/* Resumo */}
                                <div className="mb-8 flex items-center gap-4 rounded-md border border-[var(--cieps-line)] bg-[var(--cieps-paper)] p-4">
                                    <div className="flex shrink-0 items-center justify-center text-[var(--cieps-blue)]">
                                        <BarChart3 size={28} />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 font-[family-name:var(--cieps-display)] text-[0.9rem] font-bold text-[var(--cieps-ink)]">
                                            Resumo
                                        </h3>
                                        <p className="m-0 text-sm text-[var(--cieps-muted)]">
                                            {data.pagamento.lista_pagamentos?.length ?
                                                `${data.pagamento.lista_pagamentos?.length.toString().padStart(2, '0')} pagamentos encontrados` :
                                                "Você ainda não realizou nenhum pagamento."
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* Lista de Pagamentos */}
                                {data.pagamento.lista_pagamentos.length > 0 && (
                                    <div className="flex flex-col gap-4">
                                        {data.pagamento.lista_pagamentos?.map((value, index) => (
                                            <CardPagamentos
                                                key={index}
                                                eventId={data.pagamento.lista_pagamentos[index]?._eventID || ""}
                                                type={data.pagamento.lista_pagamentos[index]?._type || ""}
                                                invoiceUrl={value.invoiceUrl}
                                                valor={value.value}
                                                data_formatada={value.dateCreated}
                                                invoiceNumber={value.invoiceNumber}
                                                status={value.status}
                                                description={value.description}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        )

    }

    return (
        <div>
            {/* ---> ESSA TELA É EXCLUSIVAMENTE PARA OS PAGAMENTOS AUTOMATICOS <--- */}
            {
                dataPaymentConfig.modo == "automatico" &&
                (
                    dataPaymentConfig.sessaoPagamentoAutomáticoAtiva !== false ? (
                        <PaymentSessionActive
                            key={[
                                String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva._id),
                                dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.status,
                                dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.metodoPagamento ?? '',
                                dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.paymentUrl ?? '',
                            ].join(':')}
                            dataPayment={{
                                ...dataPaymentConfig,
                                sessaoPagamentoAutomáticoAtiva: dataPaymentConfig.sessaoPagamentoAutomáticoAtiva,
                            }}
                            hydratePage={hidratarPágina}
                        />
                    ) :
                        <NotPayedYet dataPaymentConfig={dataPaymentConfig} hydratePage={hidratarPágina} />
                )
            }
            {
                dataPaymentConfig.modo == "manual" && (
                    <PagamentosManual
                        initialPayment={data.pagamento}
                        config={dataPaymentConfig}
                        onRefresh={retryPage}
                    />
                )
            }
        </div >
    );
};
//
function PaymentSessionActive({
    dataPayment,
    hydratePage
}: {
    dataPayment: IPaymentConfig & { sessaoPagamentoAutomáticoAtiva: PaymentTicketProps },
    hydratePage: () => void
}) {
    const router = useRouter();
    const [paymentConfig, setPaymentConfig] = useState<IPaymentConfig & { sessaoPagamentoAutomáticoAtiva: PaymentTicketProps }>(dataPayment)
    const [tempoRestante, setTempoRestante] = useState<string>("Calculando...");
    const [textError, setTextError] = useState<string | false>(false);
    const [paymentType, setpaymentType] = useState<"PIX" | "CREDIT_CARD" | "NONE">(() => {
        const session = dataPayment.sessaoPagamentoAutomáticoAtiva;
        if (session.metodoPagamento === "CREDIT_CARD") return "CREDIT_CARD";
        return session.metodoPagamento === "PIX" || (!session.metodoPagamento && session.paymentUrl) ? "PIX" : "NONE";
    });
    const [copied, setCopied] = useState(false);
    const [isCreatingPix, setIsCreatingPix] = useState(false);
    const [pixError, setPixError] = useState<string | null>(null);
    const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
    const [isSwitchingToCard, setIsSwitchingToCard] = useState(false);
    const [switchMessage, setSwitchMessage] = useState<string | null>(null);
    const [checkoutAwaitingVerification, setCheckoutAwaitingVerification] = useState(false);
    const [isRefreshingProcessing, setIsRefreshingProcessing] = useState(false);
    const [processingRefreshError, setProcessingRefreshError] = useState<string | null>(null);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isCancellingPurchase, setIsCancellingPurchase] = useState(false);
    const [cancelMessage, setCancelMessage] = useState<string | null>(null);
    const expirationRefreshRequested = useRef(false);
    const processingRefreshInFlight = useRef(false);
    const purchaseCancellationInFlight = useRef(false);

    const paymentSession = paymentConfig.sessaoPagamentoAutomáticoAtiva;
    const lote = paymentSession.paymentConfig;
    const sessionStatus = String(paymentSession.status);
    const hasPixCheckout = Boolean(
        paymentSession.pixCode ||
        (paymentSession.paymentUrl && (!paymentSession.metodoPagamento || paymentSession.metodoPagamento === "PIX")),
    );
    const paymentMethodLocked = paymentSession.metodoPagamento;
    const isPixPending = sessionStatus === "PAYMENT_PENDING" && paymentMethodLocked === "PIX";
    const cardAllowed = paymentSession.metodosPagamentoPermitidos
        ? paymentSession.metodosPagamentoPermitidos.includes("CREDIT_CARD")
        : paymentConfig.pagamentosAceitos?.includes("CREDIT_CARD") !== false;
    const isAwaitingPaymentCreation = sessionStatus === "CREATING_PAYMENT" || (
        (sessionStatus === "PAYMENT_PENDING" || sessionStatus === "PENDING") && !hasPixCheckout
    );
    const paymentSwitchStatus = String(paymentSession.paymentMethodSwitch?.status || '');
    const purchaseCancellationStatus = String(paymentSession.purchaseCancellation?.status || '');
    const paymentSwitchInProgress = ['CANCELLING', 'RETRYABLE', 'REVIEW_REQUIRED']
        .includes(paymentSwitchStatus);
    const purchaseCancellationInProgress = ['CANCELLING', 'RETRYABLE', 'REVIEW_REQUIRED']
        .includes(purchaseCancellationStatus);
    const purchaseCancellationDetected = purchaseCancellationStatus === 'PAYMENT_DETECTED';
    const canOfferPurchaseCancellation = (
        (sessionStatus === 'OPEN' || isPixPending) &&
        !isCreatingPix &&
        !isSwitchingToCard &&
        !paymentSwitchInProgress &&
        paymentSwitchStatus !== 'PAYMENT_DETECTED' &&
        !purchaseCancellationInProgress &&
        !purchaseCancellationDetected
    );

    const refreshProcessingPayment = useCallback(async (showError: boolean) => {
        if (processingRefreshInFlight.current) return;
        processingRefreshInFlight.current = true;
        setIsRefreshingProcessing(true);

        try {
            const response = await fetchWithTimeout('/api/payment/paymentConfigs', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Não foi possível consultar a situação do pagamento.');
            }

            const refreshedConfig = await response.json() as PaymentConfigView;
            if (refreshedConfig.sessaoPagamentoAutomáticoAtiva === false) {
                await hydratePage();
                return;
            }

            setPaymentConfig(refreshedConfig as IPaymentConfig & {
                sessaoPagamentoAutomáticoAtiva: PaymentTicketProps;
            });
            setProcessingRefreshError(null);
        } catch {
            if (showError) {
                setProcessingRefreshError('Não foi possível atualizar agora. Aguarde alguns segundos e tente novamente.');
            }
        } finally {
            processingRefreshInFlight.current = false;
            setIsRefreshingProcessing(false);
        }
    }, [hydratePage]);

    useEffect(() => {
        if (!isAwaitingPaymentCreation) return;

        const initialRefresh = window.setTimeout(() => {
            void refreshProcessingPayment(false);
        }, 1500);
        const refreshInterval = window.setInterval(() => {
            void refreshProcessingPayment(false);
        }, 5000);

        return () => {
            window.clearTimeout(initialRefresh);
            window.clearInterval(refreshInterval);
        };
    }, [isAwaitingPaymentCreation, refreshProcessingPayment]);

    const handleSelectPix = async () => {
        setpaymentType("PIX");
        setPixError(null);

        if (hasPixCheckout || isCreatingPix) return;
        if (paymentMethodLocked && paymentMethodLocked !== "PIX") {
            setPixError("Esta sessão já está vinculada a outra forma de pagamento.");
            return;
        }

        setIsCreatingPix(true);
        try {
            const response = await fetchWithTimeout('/api/v1/payment/session/pix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: paymentSession._id }),
            }, 30_000);
            const result = (await response.json().catch(() => ({}))) as {
                paymentUrl?: string;
                pixCode?: string | null;
                checkoutExpiresAt?: string | null;
                message?: string;
            };

            if (!response.ok || !result.paymentUrl) {
                throw new Error(result.message || 'Não foi possível criar a cobrança PIX.');
            }

            setPaymentConfig((current) => ({
                ...current,
                sessaoPagamentoAutomáticoAtiva: {
                    ...current.sessaoPagamentoAutomáticoAtiva,
                    paymentUrl: result.paymentUrl,
                    pixCode: result.pixCode ?? current.sessaoPagamentoAutomáticoAtiva.pixCode ?? null,
                    checkoutExpiresAt: result.checkoutExpiresAt ?? current.sessaoPagamentoAutomáticoAtiva.checkoutExpiresAt ?? null,
                    metodoPagamento: "PIX",
                    status: "PAYMENT_PENDING",
                },
            }));
        } catch (error) {
            setPixError(error instanceof Error ? error.message : 'Não foi possível criar a cobrança PIX.');
        } finally {
            setIsCreatingPix(false);
        }
    };

    const handleSwitchToCard = async () => {
        if (isSwitchingToCard) return;
        setIsSwitchingToCard(true);
        setSwitchMessage(null);
        try {
            const response = await fetchWithTimeout('/api/v1/payment/session/switch-to-credit-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: paymentSession._id }),
            }, 30_000);
            const result = (await response.json().catch(() => ({}))) as {
                message?: string;
                session?: PaymentTicketProps;
            };
            if (response.status === 200 && result.session) {
                setPaymentConfig((current) => ({
                    ...current,
                    sessaoPagamentoAutomáticoAtiva: result.session as PaymentTicketProps,
                }));
                setpaymentType("CREDIT_CARD");
                setSwitchConfirmOpen(false);
                await hydratePage();
                return;
            }
            setSwitchConfirmOpen(false);
            setSwitchMessage(result.message || 'O cancelamento do PIX ainda precisa ser verificado.');
            await hydratePage();
        } catch (error) {
            setSwitchConfirmOpen(false);
            setSwitchMessage(
                error instanceof Error
                    ? error.message
                    : 'O cancelamento do PIX ainda precisa ser verificado.',
            );
        } finally {
            setIsSwitchingToCard(false);
        }
    };

    const handleCancelPurchase = async () => {
        if (purchaseCancellationInFlight.current) return;
        purchaseCancellationInFlight.current = true;
        setIsCancellingPurchase(true);
        setCancelMessage(null);
        try {
            const response = await fetchWithTimeout('/api/v1/payment/session/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: paymentSession._id }),
            }, 30_000);
            const result = (await response.json().catch(() => ({}))) as {
                message?: string;
            };

            if (response.status === 200) {
                setCancelConfirmOpen(false);
                router.replace('/');
                return;
            }

            setCancelConfirmOpen(false);
            setCancelMessage(
                result.message || 'O cancelamento ainda precisa ser verificado.',
            );
            await refreshProcessingPayment(false);
        } catch (error) {
            setCancelConfirmOpen(false);
            setCancelMessage(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível confirmar o cancelamento agora.',
            );
            await refreshProcessingPayment(false);
        } finally {
            purchaseCancellationInFlight.current = false;
            setIsCancellingPurchase(false);
        }
    };

    useEffect(() => {
        const expirationValue = isPixPending && paymentSession.checkoutExpiresAt
            ? paymentSession.checkoutExpiresAt
            : paymentSession.expiresAt;
        const dataExpiracao = new Date(expirationValue).getTime();
        const timer = setInterval(() => {
            const agora = new Date().getTime();
            const diferenca = dataExpiracao - agora;

            if (diferenca <= 0) {
                clearInterval(timer);
                setTempoRestante("00:00");
                if (isPixPending) {
                    setCheckoutAwaitingVerification(true);
                    if (!expirationRefreshRequested.current) {
                        expirationRefreshRequested.current = true;
                        void hydratePage();
                    }
                } else {
                    setTextError("O tempo da reserva terminou. Atualize para consultar o lote e os valores vigentes.");
                }
            } else {
                const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diferenca % (1000 * 60)) / 1000);

                const minutosFormatados = String(minutos).padStart(2, '0');
                const segundosFormatados = String(segundos).padStart(2, '0');

                setTempoRestante(`${minutosFormatados}:${segundosFormatados}`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [hydratePage, isPixPending, paymentSession.checkoutExpiresAt, paymentSession.expiresAt]);

    if (sessionStatus === "PAYMENT_REVIEW_REQUIRED") {
        return (
            <div className='pagamentos-main max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-linha'>
                <h1>Seu pagamento precisa de verificação</h1>
                <p>A cobrança está protegida contra duplicidade. Entre em contato com a organização antes de tentar novamente.</p>
            </div>
        )
    }
    if (isAwaitingPaymentCreation) {
        return (
            <PageShell className="flex items-center justify-center px-4 py-10 sm:px-6">
                <section
                    className="w-full max-w-3xl overflow-hidden rounded-lg border border-linha bg-[var(--cieps-paper-strong)] shadow-[var(--cieps-shadow)]"
                    role="status"
                    aria-live="polite"
                >
                    <div className="h-1.5 w-full bg-gradient-to-r from-goles via-ipe to-araguari" aria-hidden="true" />
                    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center sm:px-12">
                        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-goles/20 bg-goles/10 text-goles">
                            <Loader2 className="animate-spin" size={30} strokeWidth={2.25} aria-hidden="true" />
                        </span>

                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-goles">
                            Pagamento seguro
                        </span>
                        <h1 className="cieps-display mt-3 text-[clamp(1.75rem,4vw,2.7rem)] font-semibold leading-tight tracking-[-0.03em] text-tinta">
                            Estamos preparando seu pagamento
                        </h1>
                        <p className="mt-4 max-w-xl font-sans text-[0.98rem] leading-7 text-muted">
                            Estamos confirmando os dados da cobrança com o Asaas. Isso normalmente leva apenas alguns segundos.
                        </p>

                        <div className="mt-7 flex max-w-xl items-start gap-3 rounded-md border border-araguari/25 bg-araguari/5 px-4 py-3 text-left text-sm leading-6 text-muted">
                            <CheckCircle className="mt-0.5 shrink-0 text-araguari" size={19} aria-hidden="true" />
                            <p>
                                Sua vaga e os valores escolhidos continuam reservados. Não tente gerar outra cobrança enquanto esta verificação estiver em andamento.
                            </p>
                        </div>

                        {processingRefreshError && (
                            <p className="mt-5 max-w-xl text-sm font-semibold text-goles" role="alert">
                                {processingRefreshError}
                            </p>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            className="mt-7"
                            loading={isRefreshingProcessing}
                            onClick={() => void refreshProcessingPayment(true)}
                        >
                            Atualizar situação
                        </Button>
                        <p className="mt-4 text-xs text-muted">
                            A situação também é atualizada automaticamente nesta página.
                        </p>
                    </div>
                </section>
            </PageShell>
        )
    }
    if (sessionStatus === "CONFIRMED" || sessionStatus === "PAID") {
        return (
            <div className='pagamentos-main max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-linha'>
                <h1>Você já realizou o pagamento!</h1>
            </div>
        )
    }

    return (
        <div className='pagamentos-main max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-linha'>
            {/* MODAL DE ERRO */}
            {textError && (
                <ModalError
                    texto={textError}
                    handleIsModalError={(value: string | false) => {
                        setTextError(false)
                        void hydratePage()
                    }}
                />
            )}
            <Modal
                open={switchConfirmOpen}
                onClose={() => {
                    if (!isSwitchingToCard) setSwitchConfirmOpen(false);
                }}
                title="Cancelar PIX e trocar para cartão"
            >
                <StatusBanner
                    tone="warning"
                    title="Confirme antes de continuar"
                >
                    O código PIX atual será cancelado no Asaas. Se você já realizou o PIX, não continue: aguarde a confirmação do pagamento.
                </StatusBanner>
                <p className='mt-4 text-sm text-muted'>
                    Após o cancelamento confirmado, criaremos uma nova sessão de cartão com o mesmo lote, preço e desconto.
                </p>
                <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
                    <Button
                        variant="ghost"
                        disabled={isSwitchingToCard}
                        onClick={() => setSwitchConfirmOpen(false)}
                    >
                        Manter PIX
                    </Button>
                    <Button
                        disabled={isSwitchingToCard}
                        onClick={() => void handleSwitchToCard()}
                    >
                        {isSwitchingToCard ? 'Cancelando PIX...' : 'Confirmar troca'}
                    </Button>
                </div>
            </Modal>
            <Modal
                open={cancelConfirmOpen}
                onClose={() => {
                    if (!isCancellingPurchase) setCancelConfirmOpen(false);
                }}
                title="Desistir da compra e sair"
            >
                <StatusBanner tone="warning" title="Esta ação libera sua reserva">
                    {isPixPending
                        ? 'O checkout PIX será consultado e cancelado no Asaas. Se você já realizou o pagamento, não continue: aguarde a confirmação.'
                        : 'Sua vaga e o eventual código de desconto serão liberados imediatamente.'}
                </StatusBanner>
                <p className='mt-4 text-sm text-muted'>
                    Ao voltar, a disponibilidade, o lote e os valores podem ser diferentes. O cancelamento não pode ser desfeito.
                </p>
                <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
                    <Button
                        variant="ghost"
                        disabled={isCancellingPurchase}
                        onClick={() => setCancelConfirmOpen(false)}
                    >
                        Continuar compra
                    </Button>
                    <Button
                        variant="danger"
                        loading={isCancellingPurchase}
                        onClick={() => void handleCancelPurchase()}
                    >
                        {isCancellingPurchase ? 'Cancelando compra...' : 'Cancelar compra e sair'}
                    </Button>
                </div>
            </Modal>

            <div className='flex flex-col gap-6'>

                {cancelMessage && (
                    <StatusBanner tone="warning" title="Cancelamento em verificação">
                        {cancelMessage}
                    </StatusBanner>
                )}
                {purchaseCancellationInProgress && (
                    <StatusBanner tone="warning" title="Cancelamento da compra em andamento">
                        A vaga e o desconto continuam reservados até a confirmação segura do cancelamento.
                    </StatusBanner>
                )}
                {purchaseCancellationDetected && (
                    <StatusBanner tone="info" title="Pagamento PIX identificado">
                        A compra não foi cancelada. Aguarde a confirmação do pagamento antes de sair.
                    </StatusBanner>
                )}
                {switchMessage && (
                    <StatusBanner tone="warning" title="Troca de pagamento em verificação">
                        {switchMessage}
                    </StatusBanner>
                )}
                {checkoutAwaitingVerification && (
                    <StatusBanner tone="warning" title="Verificando a situação do PIX">
                        O prazo exibido terminou, mas sua vaga e seu desconto continuam reservados até o Asaas confirmar o estado da cobrança.
                    </StatusBanner>
                )}
                {['CANCELLING', 'RETRYABLE', 'REVIEW_REQUIRED'].includes(String(paymentSession.paymentMethodSwitch?.status || '')) && (
                    <StatusBanner tone="warning" title="Cancelamento do PIX em andamento">
                        Não realize um pagamento por cartão enquanto o cancelamento do PIX não for confirmado.
                    </StatusBanner>
                )}
                {paymentSession.paymentMethodSwitch?.status === 'PAYMENT_DETECTED' && (
                    <StatusBanner tone="info" title="Pagamento PIX identificado">
                        Aguarde a confirmação do PIX. Uma nova cobrança de cartão não será criada.
                    </StatusBanner>
                )}

                {/* CABEÇALHO DE SUCESSO E CRONÔMETRO */}
                <div className='flex items-center gap-2 text-[#2f7651] font-bold w-full text-center'>
                    <h1 className='w-full text-center text-2xl font-bold text-tinta'>{lote.nome}</h1>
                </div>
                <div className='flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#2f7651]/10 p-4 rounded-lg border border-[#2f7651]/30'>
                    <div className='text-[#245f41] font-medium'>
                        🎉 Parabéns! Sua vaga está reservada.
                    </div>
                    <div className='bg-white px-4 py-2 rounded-md shadow-sm border border-red-200 text-red-600 font-bold flex items-center gap-2'>
                        <span className='text-sm uppercase tracking-wider text-red-400'>
                            {isPixPending ? 'PIX disponível:' : 'Tempo restante:'}
                        </span>
                        <span className='text-xl'>{tempoRestante}</span>
                    </div>
                </div>

                {/* RESUMO DO LOTE */}
                <div className='bg-papel p-5 rounded-lg border border-linha flex flex-col gap-3'>
                    <h2 className='text-lg font-bold text-tinta mb-2 border-b border-linha pb-2'>
                        Resumo do Pagamento - {lote.nome}
                    </h2>

                    {paymentSession.valoresCentavos && (
                        <div className='rounded-lg border border-[#2f7651]/25 bg-[#2f7651]/10 p-4' aria-label="Resumo dos valores da inscrição">
                            <PaymentAmountsSummary
                                amounts={paymentSession.valoresCentavos}
                                methods={paymentConfig.pagamentosAceitos}
                            />
                            {(paymentSession.codigoDesconto || paymentSession.codigoRastreio) && (
                                <div className='mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted'>
                                    {paymentSession.codigoDesconto && (
                                        <span className='rounded-full bg-white px-3 py-1'>
                                            Desconto: {paymentSession.codigoDesconto.codigo}
                                        </span>
                                    )}
                                    {paymentSession.codigoRastreio && (
                                        <span className='rounded-full bg-white px-3 py-1'>
                                            Rastreio: {paymentSession.codigoRastreio.codigo}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
                        <div className='flex flex-col gap-2'>
                            <p className='text-tinta'><span className='font-semibold text-[#2f7651]'>PIX:</span> R$ {lote.precos.valorPix}</p>
                            <p className='text-tinta'><span className='font-semibold'>Boleto:</span> R$ {lote.precos.valorBoleto}</p>
                            <p className='text-tinta'><span className='font-semibold'>Débito:</span> R$ {lote.precos.valorDebito}</p>
                            <p className='text-tinta'><span className='font-semibold'>Crédito à vista:</span> R$ {lote.precos.valorAVista}</p>
                        </div>
                        <div className='flex flex-col gap-2'>
                            <span className='font-semibold text-goles'>Opções de Parcelamento (Crédito):</span>
                            {lote.precos.parcelamentos.map((props, index) => (
                                <div key={index} className='text-muted pl-2 border-l-2 border-goles/30'>
                                    {props.totalParcelas}x de R$ {props.valorCadaParcela}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ESCOLHA DO MÉTODO DE PAGAMENTO */}
                <div className='flex flex-col gap-3 mt-2'>
                    <h3 className='font-semibold text-tinta'>Como deseja pagar?</h3>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        <button
                            type="button"
                            onClick={() => void handleSelectPix()}
                            disabled={isCreatingPix || purchaseCancellationInProgress || purchaseCancellationDetected || (Boolean(paymentMethodLocked) && paymentMethodLocked !== "PIX")}
                            aria-busy={isCreatingPix}
                            className={`p-4 rounded-xl border-2 font-bold transition-all text-center disabled:cursor-not-allowed disabled:opacity-60 ${paymentType === "PIX" ? 'border-[#2f7651] bg-[#2f7651]/10 text-[#2f7651]' : 'border-linha bg-white text-muted hover:border-[#2f7651]/40'}`}
                        >
                            {isCreatingPix ? 'Preparando PIX...' : 'Pagar com PIX'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setpaymentType("CREDIT_CARD")}
                            disabled={hasPixCheckout || purchaseCancellationInProgress || purchaseCancellationDetected || (Boolean(paymentMethodLocked) && paymentMethodLocked !== "CREDIT_CARD") || !cardAllowed}
                            className={`p-4 rounded-xl border-2 font-bold transition-all text-center disabled:cursor-not-allowed disabled:opacity-60 ${paymentType === "CREDIT_CARD" ? 'border-goles bg-goles/10 text-goles' : 'border-linha bg-white text-muted hover:border-goles/40'}`}
                        >
                            Cartão de Crédito
                        </button>
                    </div>
                    {isPixPending && cardAllowed && (
                        <button
                            type="button"
                            disabled={isSwitchingToCard || purchaseCancellationInProgress || purchaseCancellationDetected || paymentSession.paymentMethodSwitch?.status === 'PAYMENT_DETECTED'}
                            onClick={() => setSwitchConfirmOpen(true)}
                            className='inline-flex min-h-11 items-center justify-center rounded-lg border border-goles px-5 py-2.5 font-bold text-goles transition-colors hover:bg-goles/5 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            Cancelar PIX e trocar para cartão
                        </button>
                    )}
                    {canOfferPurchaseCancellation && (
                        <div className='flex justify-stretch pt-2 sm:justify-end'>
                            <Button
                                type="button"
                                variant="danger"
                                className="w-full sm:w-auto"
                                onClick={() => setCancelConfirmOpen(true)}
                            >
                                <CircleX size={18} aria-hidden="true" />
                                Desistir da compra e sair
                            </Button>
                        </div>
                    )}
                </div>

                {/* RENDERIZAÇÃO CONDICIONAL DOS MÉTODOS */}
                <div className='mt-2'>
                    {paymentType === "PIX" && (

                        <div className='flex flex-col items-center justify-center p-8 bg-papel border-2 border-dashed border-linha rounded-xl gap-4'>
                            {pixError && (
                                <div className='w-full rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700' role="alert">
                                    {pixError}
                                </div>
                            )}
                            {
                                paymentSession.pixCode != null ?
                                    <div>
                                        <p className='text-muted font-medium text-center'>Escaneie o QR Code ou copie o código PIX</p>
                                        <div className='w-48 h-48 bg-[var(--cieps-paper)] border border-[var(--cieps-line)] rounded-lg flex items-center justify-center text-[var(--cieps-blue)] font-bold' aria-label="Código PIX disponível para cópia">
                                            <QrCode size={88} aria-hidden="true" />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={checkoutAwaitingVerification}
                                            className='mt-2 inline-flex items-center justify-center gap-2 px-6 py-2 bg-[var(--cieps-red)] text-white font-medium rounded-lg hover:bg-[#8f2323] transition-colors disabled:cursor-not-allowed disabled:opacity-60'
                                            onClick={async () => {
                                                await navigator.clipboard.writeText(paymentSession.pixCode ?? '');
                                                setCopied(true);
                                            }}
                                        >
                                            <Copy size={17} aria-hidden="true" />
                                            {copied ? 'Código copiado' : 'Copiar Código PIX'}
                                        </button>
                                    </div> : isCreatingPix ?
                                        <div className='flex flex-col items-center gap-3 py-4 text-center text-muted' role="status" aria-live="polite">
                                            <Loader2 className='animate-spin text-[#2f7651]' size={28} aria-hidden="true" />
                                            <p>Preparando sua cobrança PIX segura...</p>
                                        </div> : paymentSession.paymentUrl ?
                                            <div className='flex flex-col items-center justify-center text-center gap-3 w-full'>
                                                <div className='flex flex-col gap-1'>
                                                    <p className='text-[var(--cieps-ink)] font-bold text-lg'>
                                                        Seu ambiente de pagamento está pronto!
                                                    </p>
                                                    <p className='text-[var(--cieps-muted)] text-sm max-w-sm'>
                                                        Clique no botão abaixo para acessar a página segura e concluir sua transação.
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={checkoutAwaitingVerification}
                                                    className='mt-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 px-8 py-3 bg-[#2f7651] text-white font-bold rounded-xl hover:bg-[#245f41] transition-all shadow-md hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60'
                                                    onClick={() => {
                                                        window.open(paymentSession.paymentUrl ?? '', "_blank", 'noopener,noreferrer');
                                                    }}
                                                >
                                                    Ir para pagamento
                                                    <ArrowRight size={20} aria-hidden="true" />
                                                </button>
                                            </div> :
                                            <div className='flex flex-col items-center justify-center gap-3 text-center'>
                                                <p className='text-sm text-muted'>A cobrança PIX ainda não foi criada.</p>
                                                <button
                                                    type="button"
                                                    className='inline-flex items-center justify-center rounded-lg bg-[#2f7651] px-5 py-2.5 font-bold text-white hover:bg-[#245f41]'
                                                    onClick={() => void handleSelectPix()}
                                                >
                                                    Tentar novamente
                                                </button>
                                            </div>
                            }
                        </div>
                    )}

                    <PaymentForm
                        isModalOpen={paymentType === "CREDIT_CARD"}
                        onClose={() => setpaymentType("NONE")}
                        dataPaymentConfig={paymentConfig}
                        hydratePage={hydratePage}
                    />
                </div>

            </div>
        </div >
    );
}
//
function NotPayedYet({ dataPaymentConfig, hydratePage }: { dataPaymentConfig: PaymentConfigView; hydratePage: () => void }) {
    const [modalAction, setModalAction] = useState<'refresh-lot' | null>(null);
    const [step, setStep] = useState(0);
    const [textoModal, setTextoModal] = useState<string | false>(false);
    const [loadingModal, setLoadingModal] = useState<boolean>(false);
    const ticketRequestInFlight = useRef(false);
    const loteAtual = dataPaymentConfig.loteAutomaticoAtual;
    const [codigoDesconto, setCodigoDesconto] = useState('');
    const [codigoRastreio, setCodigoRastreio] = useState('');
    const [codesPreview, setCodesPreview] = useState<PaymentCodesPreview | null>(null);
    const [codesMessage, setCodesMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [isPreviewingCodes, setIsPreviewingCodes] = useState(false);

    const hasInformedCodes = Boolean(normalizePaymentCode(codigoDesconto) || normalizePaymentCode(codigoRastreio));

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
        if (!loteAtual) {
            setCodesMessage({ tone: 'error', text: 'Não foi possível identificar o lote atual.' });
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
                    loteCodigo: loteAtual.codigo,
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

    // Estado para guardar os dados do formulário
    const [formData, setFormData] = useState({
        nome: '',
        cpf: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        telefone: '',
        email: '',
    });

    // Estado para guardar mensagens de erro
    const [erros, setErros] = useState<{ [key: string]: string }>({});

    // --- NOVA FUNÇÃO DE VALIDAÇÃO DE E-MAIL ---
    const validarEmail = (email: string) => {
        // Expressão regular simples para validar formato nome@dominio.com
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const validarCPF = (cpf: string) => {
        // Rejeita imediatamente se houver pontuação, letras ou se não tiver exatamente 11 números
        if (!/^\d{11}$/.test(cpf)) return false;

        // Rejeita CPFs com todos os números iguais (ex: 11111111111, 00000000000)
        if (!!cpf.match(/(\d)\1{10}/)) return false;

        let t = 9;
        for (let d = 0, c = 0; t < 11; t++) {
            for (d = 0, c = 0; c < t; c++) d += parseInt(cpf[c]) * ((t + 1) - c);
            d = ((10 * d) % 11) % 10;
            if (cpf[c] !== d.toString()) return false;
        }

        return true;
    };

    // Validação do Passo 1
    const handleAvancarParaPasso2 = () => {
        const novosErros: { [key: string]: string } = {};

        if (!formData.nome.trim()) novosErros.nome = 'O nome completo é obrigatório.';

        if (!formData.cpf.trim()) {
            novosErros.cpf = 'O CPF é obrigatório.';
        } else if (!validarCPF(formData.cpf)) {
            novosErros.cpf = 'CPF inválido. Verifique os números.';
        }

        // Validação de Telefone (adicionado para não deixar passar em branco)
        if (!formData.telefone.trim()) novosErros.telefone = 'O telefone é obrigatório.';

        // --- NOVA VALIDAÇÃO DE E-MAIL AQUI ---
        if (!formData.email.trim()) {
            novosErros.email = 'O e-mail é obrigatório.';
        } else if (!validarEmail(formData.email)) {
            novosErros.email = 'E-mail inválido. Verifique o formato.';
        }

        if (Object.keys(novosErros).length > 0) {
            setErros(novosErros);
        } else {
            setErros({});
            setStep(2);
        }
    };

    // Validação do Passo 2 (Finalizar)
    const handleGerarTicket = async () => {
        if (ticketRequestInFlight.current) return;
        const novosErros: { [key: string]: string } = {};

        if (hasInformedCodes && !codesPreview) {
            setCodesMessage({ tone: 'error', text: 'Valide os códigos informados antes de criar a sessão de pagamento.' });
            return;
        }

        if (!formData.cep.trim()) novosErros.cep = 'O CEP é obrigatório.';
        if (!formData.rua.trim()) novosErros.rua = 'A rua é obrigatória.';
        if (!formData.numero.trim()) novosErros.numero = 'O número é obrigatório.';
        if (!formData.bairro.trim()) novosErros.bairro = 'O bairro é obrigatório.';

        if (Object.keys(novosErros).length > 0) {
            setErros(novosErros);
            return;
        } else {
            setErros({});
        }

        ticketRequestInFlight.current = true;
        setLoadingModal(true);
        setModalAction(null);
        try {
            const paymentPostResponse = await fetchWithTimeout(`/api/v1/payment/session/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    loteAtualFrontEnd: loteAtual,
                    codigoDesconto: normalizePaymentCode(codigoDesconto) || null,
                    codigoRastreio: normalizePaymentCode(codigoRastreio) || null,
                }),
            });
            const responseData: { error?: string; message?: string } = await paymentPostResponse.json().catch(() => ({}));
            if (!paymentPostResponse.ok) {
                if (String(responseData.error || '').toLowerCase() === 'payment_lot_changed') {
                    resetCodesPreview();
                    setModalAction('refresh-lot');
                    setTextoModal(responseData.message || 'O lote vigente foi atualizado.');
                    return;
                }
                throw new Error(responseData.message || "Ocorreu um erro ao processar seu pagamento.");
            }
            await hydratePage();
        } catch (error) {
            setModalAction(null);
            setTextoModal(error instanceof Error ? error.message : "Ocorreu um erro ao processar seu pagamento.");
        } finally {
            ticketRequestInFlight.current = false;
            setLoadingModal(false);
        }
    };

    return (
        <div className='pagamentos-main'>
            {loadingModal && <LoadingModal />}
            {textoModal && (
                <ModalError
                    texto={textoModal}
                    handleIsModalError={(value) => setTextoModal(value)}
                    actionLabel={modalAction === 'refresh-lot' ? 'Atualizar valores' : undefined}
                    onAction={modalAction === 'refresh-lot'
                        ? async () => {
                            setStep(0);
                            resetCodesPreview();
                            await hydratePage();
                        }
                        : undefined}
                />
            )}

            {/* ETAPA 0: INFORMAÇÕES E VALORES INICIAIS */}
            {step === 0 && (
                <div className='pagamentos-main max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-linha'>
                    <div className='flex flex-col gap-6'>
                        <div className='bg-amber-50 text-amber-800 p-4 rounded-lg border-l-4 border-amber-400 font-medium'>
                            Seu Pagamento ainda não foi confirmado. Realize o pagamento para ter acesso total à página do congresso.
                        </div>
                        <div className='flex flex-col gap-4'>
                            <h1 className='w-full text-2xl font-bold text-tinta text-center'>
                                {loteAtual?.nome ? `${loteAtual.nome}` : "Não foi possível identificar o lote atual."}
                            </h1>
                            <div className='text-tinta text-lg'>
                                <h1 className='inline font-bold text-goles'>Atenção! Para os primeiros {loteAtual?.limiteVagas} participantes</h1> os valores são:
                            </div>
                            <div className='bg-papel p-5 rounded-lg border border-linha flex flex-col gap-3'>
                                {
                                    dataPaymentConfig.pagamentosAceitos.map((tipoPagamento: string, index: number) => {
                                        return (
                                            <div key={index} className='text-tinta'>
                                                {tipoPagamento === "PIX" && <p className='font-semibold text-[#2f7651]'>- PIX: R$ {loteAtual?.precos.valorPix}</p>}
                                                {tipoPagamento === "BOLETO" && <p className='font-medium'>- BOLETO: R$ {loteAtual?.precos.valorBoleto}</p>}
                                                {tipoPagamento === "CREDIT_CARD" && <p className='font-medium text-goles'>- CRÉDITO: <br /> {loteAtual?.precos.parcelamentos.map((parcela: IParcelamento, idx: number) => <span key={idx} className='text-muted font-normal ml-4 block mt-1'>► {idx + 1}. vez. {parcela.totalParcelas} parcelas de R$ {parcela.valorCadaParcela}</span>)}</p>}
                                                {tipoPagamento === "DEBIT_CARD" && <p className='font-medium'>- DÉBITO: R$ {loteAtual?.precos.valorDebito}</p>}
                                            </div>
                                        )
                                    }, 30_000)
                                }
                                <section className='mt-4 border-t border-linha pt-5' aria-labelledby="payment-codes-title">
                                    <div className='mb-4'>
                                        <h2 id="payment-codes-title" className='text-base font-bold text-tinta'>Possui algum código?</h2>
                                        <p className='mt-1 text-sm text-muted'>O desconto reduz o valor. O rastreio identifica a indicação sem alterar o preço.</p>
                                    </div>

                                    <div className='grid gap-4 sm:grid-cols-2'>
                                        <div>
                                            <label htmlFor="discount-code" className='mb-1 block text-sm font-semibold text-tinta'>Código de desconto</label>
                                            <input
                                                id="discount-code"
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
                                                className='w-full rounded-lg border border-linha bg-white p-3 font-mono text-sm uppercase text-tinta outline-none transition focus:border-goles focus:ring-1 focus:ring-goles'
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="tracking-code" className='mb-1 block text-sm font-semibold text-tinta'>Código de rastreio</label>
                                            <input
                                                id="tracking-code"
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
                                                className='w-full rounded-lg border border-linha bg-white p-3 font-mono text-sm uppercase text-tinta outline-none transition focus:border-goles focus:ring-1 focus:ring-goles'
                                            />
                                        </div>
                                    </div>

                                    <div className='mt-4 flex flex-wrap gap-3'>
                                        <button
                                            type="button"
                                            onClick={() => void handlePreviewCodes()}
                                            disabled={isPreviewingCodes || !hasInformedCodes}
                                            aria-busy={isPreviewingCodes}
                                            className='inline-flex items-center justify-center gap-2 rounded-lg bg-goles px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#8f2323] disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            {isPreviewingCodes && <Loader2 className='animate-spin' size={17} aria-hidden="true" />}
                                            {isPreviewingCodes ? 'Validando...' : 'Aplicar códigos'}
                                        </button>
                                        {(hasInformedCodes || codesPreview) && (
                                            <button
                                                type="button"
                                                onClick={clearCodes}
                                                disabled={isPreviewingCodes}
                                                className='rounded-lg border border-linha bg-white px-5 py-2.5 text-sm font-semibold text-muted transition hover:border-goles/40 hover:text-tinta disabled:opacity-60'
                                            >
                                                Limpar
                                            </button>
                                        )}
                                    </div>

                                    {codesMessage && (
                                        <div
                                            className={`mt-4 rounded-lg border p-3 text-sm ${codesMessage.tone === 'success' ? 'border-[#2f7651]/30 bg-[#2f7651]/10 text-[#245f41]' : 'border-red-200 bg-red-50 text-red-700'}`}
                                            role={codesMessage.tone === 'error' ? 'alert' : 'status'}
                                            aria-live="polite"
                                        >
                                            {codesMessage.text}
                                        </div>
                                    )}

                                    {codesPreview && (
                                        <div className='mt-4 rounded-lg border border-[#2f7651]/25 bg-white p-4' aria-label="Prévia dos códigos aplicados">
                                            <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                                                {codesPreview.codigos.desconto && (
                                                    <span className='rounded-full bg-[#2f7651]/10 px-3 py-1 text-[#245f41]'>
                                                        {codesPreview.codigos.desconto.codigo} · {codesPreview.codigos.desconto.percentualDesconto}% de desconto
                                                    </span>
                                                )}
                                                {codesPreview.codigos.rastreio && (
                                                    <span className='rounded-full bg-goles/10 px-3 py-1 text-goles'>
                                                        Rastreio {codesPreview.codigos.rastreio.codigo}
                                                    </span>
                                                )}
                                            </div>
                                            <div className='mt-4'>
                                                <PaymentAmountsSummary
                                                    amounts={codesPreview.valoresCentavos}
                                                    methods={dataPaymentConfig.pagamentosAceitos}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </section>
                                <div className='mt-4 bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 text-center font-medium text-sm'>
                                    Preencha suas informações e você terá 15 minutos para realizar seu pagamento no valor prometido.
                                </div>

                                <button
                                    onClick={() => setStep(1)}
                                    className='w-full mt-2 bg-goles hover:bg-[#8f2323] text-white font-bold py-3 px-4 rounded-lg transition-colors'
                                >
                                    Preencher Informações de Pagamento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ETAPAS 1 e 2: FORMULÁRIOS COM CABEÇALHO FIXO COM TODOS OS VALORES */}
            {step > 0 && (
                <div className='max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-linha'>

                    {/* CABEÇALHO FIXO */}
                    <div className='mb-6 border-b border-linha pb-6'>
                        <h2 className='text-xl font-bold text-tinta mb-4'>Finalizar Pagamento</h2>

                        <div className='bg-papel p-4 rounded-lg border border-linha flex flex-col gap-2 mb-4 text-sm'>
                            <p className='font-bold text-tinta mb-1'>Valores do Lote Atual:</p>
                            {
                                dataPaymentConfig.pagamentosAceitos.map((tipoPagamento: string, index: number) => {
                                    return (
                                        <div key={index} className='text-tinta'>
                                            {tipoPagamento === "PIX" && <p className='font-semibold text-[#2f7651]'>- PIX: R$ {loteAtual?.precos.valorPix}</p>}
                                            {tipoPagamento === "BOLETO" && <p className='font-medium'>- BOLETO: R$ {loteAtual?.precos.valorBoleto}</p>}
                                            {tipoPagamento === "CREDIT_CARD" && <p className='font-medium text-goles'>- CRÉDITO: <br /> {loteAtual?.precos.parcelamentos.map((parcela: IParcelamento, idx: number) => <span key={idx} className='text-muted font-normal ml-4 block mt-1'>► {idx + 1}. vez. {parcela.totalParcelas} parcelas de R$ {parcela.valorCadaParcela}</span>)}</p>}
                                            {tipoPagamento === "DEBIT_CARD" && <p className='font-medium'>- DÉBITO: R$ {loteAtual?.precos.valorDebito}</p>}
                                        </div>
                                    )
                                })
                            }
                            {codesPreview && (
                                <div className='mt-3 rounded-lg border border-[#2f7651]/25 bg-[#2f7651]/10 p-3'>
                                    <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                                        {codesPreview.codigos.desconto && (
                                            <span className='rounded-full bg-white px-2.5 py-1 text-[#245f41]'>
                                                {codesPreview.codigos.desconto.percentualDesconto}% de desconto
                                            </span>
                                        )}
                                        {codesPreview.codigos.rastreio && (
                                            <span className='rounded-full bg-white px-2.5 py-1 text-goles'>Rastreio aplicado</span>
                                        )}
                                    </div>
                                    <div className='mt-3'>
                                        <PaymentAmountsSummary
                                            amounts={codesPreview.valoresCentavos}
                                            methods={dataPaymentConfig.pagamentosAceitos}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className='bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 font-medium text-sm text-center'>
                            Após concluir este formulário, você terá 15 minutos para pagar e garantir sua vaga no valor acima.
                        </div>
                    </div>

                    {/* ETAPA 1: DADOS PESSOAIS */}
                    {step === 1 && (
                        <div className='flex flex-col gap-4'>
                            <h3 className='font-semibold text-tinta mb-2'>Passo 1: Dados Pessoais</h3>

                            <div>
                                <label htmlFor="payer-name" className='block text-sm font-medium text-tinta mb-1'>Nome completo do pagador</label>
                                <input
                                    id="payer-name"
                                    type="text"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Ex: João da Silva"
                                    className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.nome ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                />
                                {erros.nome && <span className="text-red-500 text-xs mt-1 block">{erros.nome}</span>}
                            </div>

                            <div>
                                <label htmlFor="payer-cpf" className='block text-sm font-medium text-tinta mb-1'>CPF - sem pontuação</label>
                                <input
                                    id="payer-cpf"
                                    inputMode="numeric"
                                    type="text"
                                    value={formData.cpf}
                                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                    placeholder="00000000000"
                                    maxLength={14}
                                    className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.cpf ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                />
                                {erros.cpf && <span className="text-red-500 text-xs mt-1 block">{erros.cpf}</span>}
                            </div>
                            <div>
                                <label htmlFor="payer-phone" className='block text-sm font-medium text-tinta mb-1'>Telefone</label>
                                <input
                                    id="payer-phone"
                                    type="tel"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                    className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.telefone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                />
                                {erros.telefone && <span className="text-red-500 text-xs mt-1 block">{erros.telefone}</span>}
                            </div>
                            <div>
                                <label htmlFor="payer-email" className='block text-sm font-medium text-tinta mb-1'>E-mail</label>
                                <input
                                    id="payer-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="exemplo@email.com"
                                    className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                />
                                {erros.email && <span className="text-red-500 text-xs mt-1 block">{erros.email}</span>}
                            </div>

                            <div className='flex justify-between mt-4'>
                                <button onClick={() => setStep(0)} className='text-muted hover:text-tinta font-medium px-4 py-2'>
                                    Voltar
                                </button>
                                <button onClick={handleAvancarParaPasso2} className='bg-goles hover:bg-[#8f2323] text-white font-bold py-2 px-6 rounded-lg transition-colors'>
                                    Próximo Passo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ETAPA 2: ENDEREÇO */}
                    {step === 2 && (
                        <div className='flex flex-col gap-4'>
                            <h3 className='font-semibold text-tinta mb-2'>Passo 2: Endereço</h3>

                            <div>
                                <label htmlFor="payer-zip" className='block text-sm font-medium text-tinta mb-1'>CEP - sem pontuação</label>
                                <input
                                    id="payer-zip"
                                    inputMode="numeric"
                                    type="text"
                                    value={formData.cep}
                                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                                    placeholder="00000000"
                                    className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.cep ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                />
                                {erros.cep && <span className="text-red-500 text-xs mt-1 block">{erros.cep}</span>}
                            </div>

                            <div className='grid grid-cols-1 gap-4 sm:grid-cols-4'>
                                <div className='sm:col-span-3'>
                                    <label htmlFor="payer-street" className='block text-sm font-medium text-tinta mb-1'>Rua / Logradouro</label>
                                    <input
                                        id="payer-street"
                                        type="text"
                                        value={formData.rua}
                                        onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                                        className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.rua ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                    />
                                    {erros.rua && <span className="text-red-500 text-xs mt-1 block">{erros.rua}</span>}
                                </div>
                                <div className='sm:col-span-1'>
                                    <label htmlFor="payer-number" className='block text-sm font-medium text-tinta mb-1'>Número</label>
                                    <input
                                        id="payer-number"
                                        inputMode="numeric"
                                        type="text"
                                        value={formData.numero}
                                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                                        className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.numero ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                    />
                                    {erros.numero && <span className="text-red-500 text-xs mt-1 block">{erros.numero}</span>}
                                </div>
                            </div>

                            <div>
                                <label htmlFor="payer-complement" className='block text-sm font-medium text-tinta mb-1'>Complemento (opcional)</label>
                                <input
                                    id="payer-complement"
                                    type="text"
                                    value={formData.complemento}
                                    onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                                    placeholder="Apto, Bloco, Casa 2..."
                                    className='w-full border border-linha rounded-lg p-3 text-tinta focus:outline-none focus:border-goles focus:ring-1 focus:ring-goles'
                                />
                            </div>

                            <div>
                                <label htmlFor="payer-neighborhood" className='block text-sm font-medium text-tinta mb-1'>Bairro</label>
                                <input
                                    id="payer-neighborhood"
                                    type="text"
                                    value={formData.bairro}
                                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                                    className={`w-full border rounded-lg p-3 text-tinta focus:outline-none focus:ring-1 ${erros.bairro ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-linha focus:border-goles focus:ring-goles'}`}
                                />
                                {erros.bairro && <span className="text-red-500 text-xs mt-1 block">{erros.bairro}</span>}
                            </div>
                            <div className='flex justify-between mt-4'>
                                <button onClick={() => setStep(1)} className='text-muted hover:text-tinta font-medium px-4 py-2'>
                                    Voltar
                                </button>
                                <button type="button" onClick={handleGerarTicket} disabled={loadingModal} className='bg-[#2f7651] hover:bg-[#245f41] text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60'>
                                    {loadingModal ? 'Gerando sessão…' : 'Gerar ticket de pagamento'}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

//
// Tela de carregamento com imagem
const LoadingScreen = () => {
    return (
        <div className="mx-auto w-full max-w-[900px] rounded-lg border border-[var(--cieps-line)] p-[clamp(1rem,3vw,2rem)] shadow-[var(--cieps-shadow)]">
            <div className="mx-auto mb-5 w-full max-w-[1320px] p-0">

                {/* status-container / glass-container */}
                <div className="m-0 w-full max-w-none rounded-lg border border-[var(--cieps-line)] bg-[rgba(255,253,248,.96)] p-5 text-left shadow-[var(--cieps-shadow)]">

                    {/* loading-container */}
                    <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 py-8">

                        {/* Se você tiver uma imagem de logo/branding, ela vai aqui */}
                        <div className="mb-2"></div>

                        {/* Spinner usando o Loader2 (Lucide) com a cor da marca */}
                        <div className="flex items-center justify-center text-[var(--cieps-red)]">
                            <Loader2 className="h-10 w-10 animate-spin" strokeWidth={2.5} />
                        </div>

                        {/* Texto e Pontinhos animados */}
                        <div className="mt-2 flex items-center gap-1">
                            <h2 className="m-0 font-[family-name:var(--cieps-display)] text-[1.1rem] font-bold tracking-normal text-[var(--cieps-ink)] shadow-none">
                                CARREGANDO PAGAMENTOS
                            </h2>

                            {/* Animação dos 3 pontinhos usando Tailwind */}
                            <div className="flex items-center gap-[3px] pb-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--cieps-red)] [animation-delay:-0.3s]"></span>
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--cieps-red)] [animation-delay:-0.15s]"></span>
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--cieps-red)]"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Modal de carregamento
const LoadingModal = () => {
    return (
        <Modal open onClose={() => undefined} title="Processando pagamento" description="Não feche esta janela.">
            <AsyncStatePanel status="loading" loadingTitle="Preparando sua sessão" />
        </Modal>
    );
};

// Componente de erro (mantido do código original)
const ModalError = ({
    texto,
    handleIsModalError,
    actionLabel,
    onAction,
}: {
    texto: string;
    handleIsModalError: (value: string | false) => void;
    actionLabel?: string;
    onAction?: () => void | Promise<void>;
}) => {
    return (
        <Modal open onClose={() => handleIsModalError(false)} title="Não foi possível concluir">
            <StatusBanner tone="error" title="O pagamento não foi processado">{texto}</StatusBanner>
            <Button className="mt-5" full onClick={() => {
                handleIsModalError(false);
                void onAction?.();
            }}>{actionLabel || 'Entendi'}</Button>
        </Modal>
    );
};

// Componente de formulário de pagamento (mantido do código original)
const PaymentForm = ({ isModalOpen, onClose, dataPaymentConfig, hydratePage }: { isModalOpen: boolean; onClose: () => void, dataPaymentConfig: IPaymentConfig & { sessaoPagamentoAutomáticoAtiva: PaymentTicketProps }; hydratePage: () => void }) => {
    const [step, setStep] = useState(1); // 1 para informações pessoais, 2 para informações do cartão
    const [messageModalWarning2, setMessageModalWarning2] = useState("")
    const [messageModalWarning, setMessageModalWarning] = useState("")
    const [textoPagamentoEscolhido, setTextoPagametoEscolhido] = useState("")
    const [personalInfo, setPersonalInfo] = useState({
        name: String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.userProps.name || ''),
        email: String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.userProps.email || ''),
        cpfCnpj: String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.userProps.cpf || ''),
        postalCode: String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.userProps.zipCode || ''),
        addressNumber: String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.userProps.number || ''),
        phone: String(dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.userProps.phone || ''),
    });
    const [cardInfo, setCardInfo] = useState<{
        number: string,
        expiry: string,
        cvc: string,
        name: string,
        focus: "name" | "number" | "expiry" | "cvc" | ""
    }>({
        number: '',
        expiry: '',
        cvc: '',
        name: '',
        focus: '',
    });
    const [isConfirmationOpen, setConfirmationOpen] = useState(false);
    const [isLoading, setLoading] = useState(false);
    const cardRequestInFlight = useRef(false);
    const [idPagamento, setIdPagamento] = useState<number | undefined>(undefined)
    const [dataModalProps, setDataModalProps] = useState<ModalProps>({
        isOpen: false,
        onClose: () => {
            setDataModalProps((prev) => ({ ...prev, isOpen: false }))
        },
        onConfirm: () => { }
    })
    //

    const handleIdPagamento = (id: number) => {
        setIdPagamento(id)
    }

    const handlePersonalInfoChange = (evt) => {
        const { name, value } = evt.target;
        setPersonalInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleCardInfoChange = (evt) => {
        const { name, value } = evt.target;

        if (name === 'expiry') {
            const cleanedValue = value.replace(/\D/g, '');
            let formattedValue = cleanedValue.slice(0, 4);
            if (formattedValue.length > 2) {
                formattedValue = `${formattedValue.slice(0, 2)}/${formattedValue.slice(2)}`;
            }
            setCardInfo((prev) => ({ ...prev, [name]: formattedValue }));
        } else if (name === 'cvc' && value.length > 4) {
            return;
        }
        else if (name == 'number' && value.length > 19) {
            return;
        }
        else {
            setCardInfo((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleCardInfoFocus = (evt) => {
        setCardInfo((prev) => ({ ...prev, focus: evt.target.name }));
    };

    const handleSubmitPersonalInfo = (evt) => {
        evt.preventDefault();
        if (isPersonalInfoValid()) {
            setStep(2);
        }
    };

    const handleSubmitCardInfo = (evt) => {
        evt.preventDefault();
        setConfirmationOpen(true);
    };

    const handleConfirm = () => {
        setDataModalProps((prev) => ({
            ...prev,
            isOpen: true,
            onConfirm: async () => {
                if (cardRequestInFlight.current) return;
                cardRequestInFlight.current = true;
                setConfirmationOpen(false);
                setLoading(true);
                setDataModalProps((prev) => ({ ...prev, isOpen: false }))
                try {
                    // Crie o payload com as informações pessoais e de pagamento
                    const payload = {
                        personalInfo,
                        cardInfo,
                        idPagamento,
                        _id: dataPaymentConfig._id,
                        sessionId: dataPaymentConfig.sessaoPagamentoAutomáticoAtiva._id,
                    };

                    // Envie o POST request com o JSON
                    const response = await fetchWithTimeout('/api/v1/payment/session/creditCard/', { //
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    }, 30_000);
                    const result: { message?: string } = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(result.message || "Aconteceu algum erro desconhecido");
                    }

                    setMessageModalWarning(result.message || 'Pagamento processado com sucesso.')
                    setCardInfo({
                        number: '',
                        expiry: '',
                        cvc: '',
                        name: '',
                        focus: '',
                    });
                    void hydratePage();
                    // Feche o modal e faça o que for necessário após o sucesso
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Não foi possível processar o cartão.';
                    setMessageModalWarning2(
                        message.includes("Informe o endereço do titular do cartão.")
                            ? "Informe um CEP válido."
                            : message,
                    )
                } finally {
                    cardRequestInFlight.current = false;
                    setLoading(false);
                }

            }
        }))

    };

    const handleCancel = () => {
        setConfirmationOpen(false);
    };

    const isPersonalInfoValid = () => {
        return validateName(personalInfo.name) &&
            validateEmail(personalInfo.email) &&
            validateCpfCnpj(personalInfo.cpfCnpj) &&
            personalInfo.postalCode &&
            personalInfo.addressNumber &&
            personalInfo.phone;
    };

    const validateName = (name) => name.length > 5;

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const validateCpfCnpj = (cpfCnpj) => cpfCnpj.length >= 11; // Adapte conforme necessário

    const isCardInfoValid = () => {
        return cardInfo.number.length > 0 &&
            idPagamento &&
            cardInfo.expiry.length === 5 &&
            cardInfo.cvc.length > 0 &&
            cardInfo.name.length > 0;
    };


    if (!isModalOpen) return null;

    return (
        <>
            <TermModal {...dataModalProps} />
            <ResponseModal message={messageModalWarning} onClose={() => {
                setMessageModalWarning("")
                onClose()
                void hydratePage()
            }} />
            <ResponseModal2 message={messageModalWarning2} handleModalClose={() => {
                setMessageModalWarning2("")
                void hydratePage()
            }} />
            <Modal
                open={isModalOpen && !dataModalProps.isOpen && !isConfirmationOpen && !isLoading && !messageModalWarning && !messageModalWarning2}
                onClose={() => {
                    if (isLoading) return
                    setCardInfo({ number: '', expiry: '', cvc: '', name: '', focus: '' })
                    setStep(1)
                    onClose()
                }}
                title={step === 1 ? 'Dados do titular' : 'Dados do cartão'}
                description="Preencha os dados com atenção para concluir o pagamento."
                className="max-w-lg"
            >
                {step === 2 && (
                    <button
                        type="button"
                        aria-label="Voltar aos dados do titular"
                        onClick={() => setStep(1)}
                        className='mb-4 inline-flex min-h-11 items-center justify-center rounded border border-[var(--cieps-line)] px-4 py-2 font-bold text-[var(--cieps-blue)]'
                    >
                        <span>VOLTAR</span>
                    </button>
                )}
                {step === 1 && (
                    <form onSubmit={handleSubmitPersonalInfo} className=''>
                        <div className='text-center font-bold text-[#3e4095] text-[20px] mb-5'>
                            <h1>Informações Pessoais</h1>
                        </div>
                        <div className='flex flex-col space-y-3'>
                            <input
                                className='text-black mb-2 p-2 border rounded'
                                type="text"
                                name="name"
                                aria-label="Nome completo do titular"
                                autoComplete="name"
                                placeholder="Nome Completo"
                                value={personalInfo.name}
                                onChange={handlePersonalInfoChange}
                            />
                            <input
                                className='text-black mb-2 p-2 border rounded'
                                type="email"
                                name="email"
                                aria-label="E-mail do titular"
                                autoComplete="email"
                                placeholder="Email"
                                value={personalInfo.email}
                                onChange={handlePersonalInfoChange}
                            />
                            <input
                                className='text-black mb-2 p-2 border rounded'
                                type="tel"
                                name="cpfCnpj"
                                aria-label="CPF do titular"
                                inputMode="numeric"
                                placeholder="CPF"
                                value={personalInfo.cpfCnpj}
                                onChange={handlePersonalInfoChange}
                            />
                            <input
                                className='text-black mb-2 p-2 border rounded'
                                type="tel"
                                name="postalCode"
                                aria-label="CEP do titular"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                placeholder="CEP"
                                value={personalInfo.postalCode}
                                onChange={handlePersonalInfoChange}
                            />
                            <input
                                className='text-black mb-2 p-2 border rounded'
                                type="tel"
                                name="addressNumber"
                                aria-label="Número da residência"
                                inputMode="numeric"
                                placeholder="Número da Residência"
                                value={personalInfo.addressNumber}
                                onChange={handlePersonalInfoChange}
                            />
                            <input
                                className='text-black mb-2 p-2 border rounded'
                                type="tel"
                                name="phone"
                                aria-label="Telefone do titular"
                                autoComplete="tel"
                                placeholder="DDD + Telefone"
                                value={personalInfo.phone}
                                onChange={handlePersonalInfoChange}
                            />
                            <button
                                type="submit"
                                className={`bg-blue-500 text-white py-2 px-4 rounded font-bold text-[20px] ${isPersonalInfoValid() ? '' : 'opacity-50 cursor-not-allowed'}`}
                                disabled={!isPersonalInfoValid()}
                            >
                                Continuar
                            </button>
                        </div>
                    </form>
                )}
                {step === 2 && (
                    <div className=''>
                        <div className='text-center font-bold text-[#3e4095] text-[20px] mb-5'>
                            <h1>{dataPaymentConfig.nome || "PAGAMENTOS"}</h1>
                        </div>
                        <Cards
                            locale={{ valid: 'Validade', }}
                            placeholders={{ name: "SEU NOME AQUI" }}
                            number={cardInfo.number}
                            expiry={cardInfo.expiry}
                            cvc={cardInfo.cvc}
                            name={cardInfo.name}
                            focused={cardInfo.focus}
                        />
                        <form onSubmit={handleSubmitCardInfo} className='pt-3'>
                            <div className='flex flex-col text-black space-y-3'>
                                <input
                                    className='text-black mb-2 p-2 border rounded'
                                    type="text"
                                    name="number"
                                    aria-label="Número do cartão"
                                    inputMode="numeric"
                                    autoComplete="cc-number"
                                    placeholder="Número do Cartão"
                                    value={cardInfo.number}
                                    onChange={handleCardInfoChange}
                                    onFocus={handleCardInfoFocus}
                                />
                                <input
                                    className='text-black mb-2 p-2 border rounded'
                                    type="text"
                                    name="name"
                                    aria-label="Nome impresso no cartão"
                                    autoComplete="cc-name"
                                    placeholder="Nome no Cartão"
                                    value={cardInfo.name}
                                    onChange={handleCardInfoChange}
                                    onFocus={handleCardInfoFocus}
                                />
                                <input
                                    className='text-black mb-2 p-2 border rounded'
                                    type="text"
                                    name="expiry"
                                    aria-label="Validade do cartão"
                                    inputMode="numeric"
                                    autoComplete="cc-exp"
                                    placeholder="Data Vencimento"
                                    value={cardInfo.expiry}
                                    onChange={handleCardInfoChange}
                                    onFocus={handleCardInfoFocus}
                                />
                                <input
                                    className='text-black mb-2 p-2 border rounded'
                                    type="text"
                                    name="cvc"
                                    aria-label="Código de segurança do cartão"
                                    inputMode="numeric"
                                    autoComplete="cc-csc"
                                    placeholder="Número CVC"
                                    value={cardInfo.cvc}
                                    onChange={handleCardInfoChange}
                                    onFocus={handleCardInfoFocus}
                                />
                                <div className='pt-2'>
                                    <div className='text-center'>
                                        <div>
                                            <p className='font-bold text-[#3e4095]'>
                                                OPÇÕES DE PARCELAMENTO
                                            </p>
                                        </div>
                                        <div className='font-bold pb-8 text-[#3e4095]'>
                                            <p>
                                                Escolha uma das {dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.paymentConfig.precos.parcelamentos.length} opções de parcelamento disponíveis:
                                            </p>
                                        </div>
                                    </div>
                                    <div className='space-y-3'>
                                        {

                                            dataPaymentConfig.sessaoPagamentoAutomáticoAtiva.paymentConfig.precos.parcelamentos?.map((value) => {
                                                return (
                                                    <button type="button" key={value.codigo} aria-pressed={value.codigo == idPagamento} className={`w-full cursor-pointer p-5 text-left ${value.codigo == idPagamento ? 'bg-[var(--cieps-red)] text-white' : "bg-[rgba(239,159,39,.16)] text-[var(--cieps-ink)]"}`} onClick={() => {
                                                        handleIdPagamento(value.codigo)
                                                        setTextoPagametoEscolhido(
                                                            `Você escolheu realizar o pagamento em ${value.totalParcelas} parcelas de R$ ${value.valorCadaParcela.toFixed(2)}, totalizando R$${(value.valorCadaParcela * value.totalParcelas).toFixed(2)}`
                                                        )

                                                    }}
                                                    >
                                                        <div>
                                                            <p className='text-white font-bold'>
                                                                {value.codigo == idPagamento ? "SELECIONADO" : ""}
                                                            </p>
                                                        </div>
                                                        <h1>
                                                            Quero realizar o pagamento em <span className='font-bold'>{value.totalParcelas} parcelas de R${value.valorCadaParcela.toFixed(2)}</span>, totalizando <span className='font-bold'>R${(value.valorCadaParcela * value.totalParcelas).toFixed(2)}</span>.
                                                        </h1>
                                                    </button>
                                                )
                                            })
                                        }
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className={`bg-red-600 text-white py-2 px-4 rounded font-bold text-[20px] ${isCardInfoValid() ? '' : 'opacity-50 cursor-not-allowed'}`}
                                    disabled={!isCardInfoValid()}
                                >
                                    PAGAR
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </Modal>

            {/* Modal de Confirmação */}
            <Modal open={isConfirmationOpen} onClose={handleCancel} title="Confirmar pagamento">
                <StatusBanner tone="warning" title="Confira a opção selecionada">{textoPagamentoEscolhido}.</StatusBanner>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={handleCancel}>Voltar</Button>
                    <Button onClick={handleConfirm}>Continuar</Button>
                </div>
            </Modal>

            {/* Loading Spinner */}
            <Modal open={isLoading} onClose={() => undefined} title="Processando pagamento" description="Não feche esta janela.">
                <AsyncStatePanel status="loading" loadingTitle="Enviando os dados com segurança" />
            </Modal>
        </>
    );
};

const ResponseModal = ({ message, onClose }: { message: string; onClose: () => void }) => {
    if (!message) {
        return;
    }
    return <Modal open onClose={onClose} title="Pagamento atualizado">
        <StatusBanner tone="success" title="Operação concluída">{message}</StatusBanner>
        <Button className="mt-5" full onClick={onClose}>Continuar</Button>
    </Modal>;
};

const ResponseModal2 = ({ handleModalClose, message }: { handleModalClose, message: string }) => {
    if (!message) {
        return;
    }
    return <Modal open onClose={handleModalClose} title="Pagamento não concluído">
        <StatusBanner tone="error" title="Revise os dados e tente novamente">{message}</StatusBanner>
        <Button className="mt-5" full onClick={handleModalClose}>Voltar</Button>
    </Modal>;
};

const CardPagamentos = ({ eventId, type, data_formatada, invoiceNumber, status, description, valor, invoiceUrl }: {
    eventId: string, type: string, data_formatada: string, invoiceNumber: string, status: string, description: string, valor: number, invoiceUrl: string
}) => {
    const [typeText, setTypeText] = useState<string>("CARREGANDO ATIVIDADE")

    useEffect(() => {
        async function fetchData() {
            try {
                if (type == "activity" && typeText == "CARREGANDO ATIVIDADE") {
                    const response = await fetchWithTimeout(`/api/get/atividadeNomePeloId/${eventId}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                    if (!response.ok) {
                        setTypeText("ERRO AO CARREGAR NOME")
                        return;
                    }
                    const responseJson = await response.json()
                    if (!responseJson.data || Object.keys(responseJson.data).length === 0) {
                        setTypeText("Minicurso não encontrado")
                        return;
                    }

                    setTypeText(responseJson.data)
                }
            } catch {
                setTypeText("ERRO AO CARREGAR NOME")
            }
        }

        fetchData();
    }, [typeText, eventId, type]);

    // Dicionário de Status
    switch (true) {
        case status == "PAYMENT_CONFIRMED" || status == "CONFIRMED" || status == "PAYMENT_RECEIVED":
            status = "PAGO"
            break
        case status == "PAYMENT_OVERDUE":
            status = "CANCELADO"
            break
        case status == "PENDING":
            status = "PAGAMENTO PENDENTE"
            break
        case status == "PAYMENT_REFUNDED":
            status = "COBRANÇA ESTORNADA"
            break
        case status == "PAYMENT_REFUND_DENIED":
            status = "ESTORNO NEGADO"
            break
        case status == "PAYMENT_PARTIALLY_REFUNDED":
            status = "PARCIALMENTE ESTORNADO"
            break
        case status == "PAYMENT_REFUND_IN_PROGRESS":
            status = "PROCESSANDO ESTORNO"
            break
    }

    // Definindo as cores do badge com base no status (adaptado para o visual do CIEPS)
    let badgeStyles = "bg-gray-100 border-gray-200 text-gray-700";
    if (status === "PAGO") {
        badgeStyles = "bg-[#e8f5e9] border-[#c8e6c9] text-[#2e7d32]";
    } else if (status === "CANCELADO" || status.includes("NEGADO")) {
        badgeStyles = "bg-[rgba(163,45,45,.08)] border-[rgba(163,45,45,.2)] text-[var(--cieps-red)]";
    } else if (status === "PAGAMENTO PENDENTE" || status.includes("PROCESSANDO")) {
        badgeStyles = "bg-[rgba(239,159,39,.14)] border-[rgba(239,159,39,.32)] text-[var(--cieps-ink)]"; // Usa o padrão amarelo do CSS original
    }

    return (
        <div className="flex flex-col rounded-lg border border-[var(--cieps-line)] bg-[rgba(255,253,248,.96)] shadow-[var(--cieps-shadow)] transition-colors hover:bg-[var(--cieps-paper-strong)]">

            {/* Header: Valor e Status */}
            <div className="flex items-center justify-between border-b border-[var(--cieps-line)] p-4 sm:px-6">
                <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-[var(--cieps-muted)]">R$</span>
                    <span className="font-[family-name:var(--cieps-display)] text-2xl font-bold tracking-tight text-[var(--cieps-ink)]">
                        {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <div>
                    <span className={`inline-block rounded-[3px] border px-2 py-1 text-[0.68rem] font-bold tracking-wide shadow-none ${badgeStyles}`}>
                        {status}
                    </span>
                </div>
            </div>

            {/* Content: Detalhes do Pagamento */}
            <div className="flex flex-col gap-4 p-4 sm:px-6 sm:py-5">

                {/* Nome da Atividade (Se for activity) */}
                {type === "activity" && (
                    <div className="rounded border-l-4 border-[var(--cieps-blue)] bg-[var(--cieps-paper)] p-3">
                        <h4 className="m-0 font-[family-name:var(--cieps-display)] text-[1rem] font-semibold text-[var(--cieps-ink)]">
                            {typeText}
                        </h4>
                    </div>
                )}

                {/* Grid de Detalhes */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col">
                        <span className="text-[0.78rem] font-bold text-[var(--cieps-red)]">Data:</span>
                        <span className="text-[0.95rem] text-[var(--cieps-muted)]">{data_formatada}</span>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[0.78rem] font-bold text-[var(--cieps-red)]">Número:</span>
                        <span className="text-[0.95rem] font-medium text-[var(--cieps-muted)]">#{invoiceNumber}</span>
                    </div>

                    <div className="flex flex-col sm:col-span-2">
                        <span className="text-[0.78rem] font-bold text-[var(--cieps-red)]">Descrição:</span>
                        <span className="text-[0.95rem] text-[var(--cieps-muted)]">{description}</span>
                    </div>
                </div>

                {/* Ações (Link do Comprovante) */}
                {status !== "CANCELADO" && (
                    <div className="mt-2 border-t border-[var(--cieps-line)] pt-4">
                        <Link
                            target="_blank"
                            prefetch={false}
                            href={invoiceUrl}
                            className="inline-flex items-center gap-2 rounded bg-transparent p-0 text-[0.9rem] font-bold text-[var(--cieps-blue)] underline transition-colors hover:text-[#134982]"
                        >
                            <span>Ver comprovante</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}




interface TimeLeft {
    hours: number;
    minutes: number;
    seconds: number;
}

function RegistrationTimer() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
    const [isExpired, setIsExpired] = useState<boolean>(false);

    useEffect(() => {
        // Define a data alvo para o próximo meio-dia (12:00:00)
        const target = new Date();
        target.setHours(12, 0, 0, 0);

        // Se já passou do meio-dia de hoje, define para o meio-dia de amanhã
        if (Date.now() >= target.getTime()) {
            target.setDate(target.getDate() + 1);
        }

        const targetTime = target.getTime();

        const updateTimer = () => {
            const now = Date.now();
            const difference = targetTime - now;

            if (difference <= 0) {
                setIsExpired(true);
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
            } else {
                const hours = Math.floor(difference / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);

                setTimeLeft({ hours, minutes, seconds });
            }
        };

        updateTimer(); // Executa imediatamente para evitar lag inicial
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatNumber = (num: number): string => String(num).padStart(2, "0");

    // Estado de carregamento até o client montar (evita erro de hidratação no SSR)
    if (!timeLeft && !isExpired) {
        return (
            <div className="flex justify-center items-center p-12 text-[var(--cieps-ink)]/50">
                Carregando contagem...
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--cieps-ink)]/10 bg-white/50 p-8 md:p-12 shadow-xl backdrop-blur-md text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-[var(--cieps-ink)]/5 text-[var(--cieps-ink)] mb-4">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Contagem Regressiva
            </span>

            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">
                As inscrições abrem em breve!
            </h2>

            <p className="text-sm md:text-base text-[var(--cieps-ink)]/70 mb-8 max-w-md">
                Prepare-se! O lote de inscrições estará disponível exatamente às 12:00.
            </p>

            {isExpired ? (
                <div className="text-xl font-bold text-emerald-600 bg-emerald-50 px-6 py-4 rounded-xl border border-emerald-200">
                    🎉 As inscrições estão abertas!
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3 md:gap-6 w-full max-w-md">
                    {/* Horas */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--cieps-ink)] text-white shadow-lg">
                        <span className="text-3xl md:text-5xl font-extrabold font-mono tracking-tight">
                            {formatNumber(timeLeft.hours)}
                        </span>
                        <span className="text-[10px] md:text-xs uppercase tracking-widest text-white/70 mt-1">
                            Horas
                        </span>
                    </div>

                    {/* Minutos */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--cieps-ink)] text-white shadow-lg">
                        <span className="text-3xl md:text-5xl font-extrabold font-mono tracking-tight">
                            {formatNumber(timeLeft.minutes)}
                        </span>
                        <span className="text-[10px] md:text-xs uppercase tracking-widest text-white/70 mt-1">
                            Minutos
                        </span>
                    </div>

                    {/* Segundos */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--cieps-ink)] text-white shadow-lg">
                        <span className="text-3xl md:text-5xl font-extrabold font-mono tracking-tight">
                            {formatNumber(timeLeft.seconds)}
                        </span>
                        <span className="text-[10px] md:text-xs uppercase tracking-widest text-white/70 mt-1">
                            Segundos
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
export default Pagamentos;

