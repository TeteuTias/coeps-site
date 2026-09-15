'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, FileUp, Laptop, Loader2, MapPin, QrCode } from 'lucide-react';
import { AsyncStatePanel, Button, PageShell, StatusBanner } from '@/components/cieps';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';
import type PaymentTicketProps from '@/lib/types/payments/paymentTicket.t';
import type { PublicRemoteWorkAccess } from '@/lib/types/remote-work-access';

type StatusPayload = {
    editionId: string;
    regularConfirmed: boolean;
    access: PublicRemoteWorkAccess | null;
    activeSession: PaymentTicketProps | false;
    user: { name: string; email: string; cpf: string };
};

type Municipality = { code: string; name: string; uf: string; remoteEligible: boolean };
type Payer = {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    complement: string;
    phone: string;
};

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const inputClass = 'w-full rounded-md border border-[var(--cieps-line)] bg-white px-3 py-2.5 text-sm text-[var(--cieps-ink)] outline-none focus:border-[var(--cieps-red)] focus:ring-2 focus:ring-[rgba(163,45,45,.12)]';

function formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function RemoteWorkPaymentPage() {
    const [status, setStatus] = useState<StatusPayload | null>(null);
    const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
    const [uf, setUf] = useState('');
    const [municipalityCode, setMunicipalityCode] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [payer, setPayer] = useState<Payer>({ name: '', email: '', cpfCnpj: '', postalCode: '', addressNumber: '', complement: '', phone: '' });
    const [session, setSession] = useState<PaymentTicketProps | null>(null);
    const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadStatus = useCallback(async () => {
        const response = await fetchWithTimeout('/api/v1/remote-work-access', { cache: 'no-store' });
        const payload = await readJsonResponse<StatusPayload>(response);
        if (!payload) throw new Error('A API retornou uma resposta vazia.');
        setStatus(payload);
        setSession(payload.activeSession || null);
        setUf((current) => current || payload.access?.uf || '');
        setMunicipalityCode((current) => current || payload.access?.municipalityCode || '');
        setPayer((current) => ({
            ...current,
            name: current.name || payload.user.name,
            email: current.email || payload.user.email,
            cpfCnpj: current.cpfCnpj || payload.user.cpf,
        }));
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadStatus()
                .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a página.'))
                .finally(() => setLoading(false));
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadStatus]);

    useEffect(() => {
        if (!status || status.access?.status === 'ACTIVE' || !session || !['PAYMENT_PENDING', 'CREATING_PAYMENT', 'PAYMENT_REVIEW_REQUIRED'].includes(session.status)) return;
        const timer = window.setInterval(() => loadStatus().catch(() => undefined), 8_000);
        return () => window.clearInterval(timer);
    }, [loadStatus, session, status]);

    useEffect(() => {
        if (!uf) return;
        let cancelled = false;
        fetchWithTimeout(`/api/v1/remote-work-access/municipalities?uf=${uf}`)
            .then((response) => readJsonResponse<{ municipalities: Municipality[] }>(response))
            .then((payload) => {
                if (!cancelled) setMunicipalities(payload?.municipalities || []);
            })
            .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os municípios.'));
        return () => { cancelled = true; };
    }, [uf]);

    const uploadProof = async () => {
        if (!proof || !municipalityCode || !consentAccepted) {
            setError('Selecione município, comprovante e aceite os termos.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const form = new FormData();
            form.append('file', proof);
            form.append('municipalityCode', municipalityCode);
            form.append('uf', uf);
            form.append('consentAccepted', 'true');
            const response = await fetchWithTimeout('/api/v1/remote-work-access/proof', { method: 'POST', body: form }, 60_000);
            await readJsonResponse(response);
            setMessage('Comprovante salvo com segurança. Preencha os dados do pagador.');
            await loadStatus();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o comprovante.');
        } finally {
            setBusy(false);
        }
    };

    const createSession = async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetchWithTimeout('/api/v1/payment/remote-work-access/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payer }),
            }, 30_000);
            const payload = await readJsonResponse<{ session: PaymentTicketProps }>(response);
            if (!payload?.session) throw new Error('A sessão de pagamento não foi criada.');
            setSession(payload.session);
            setMessage('Sessão criada. Escolha PIX ou cartão.');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o pagamento.');
        } finally {
            setBusy(false);
        }
    };

    const pay = async () => {
        if (!session) return;
        setBusy(true);
        setError(null);
        try {
            const response = await fetchWithTimeout(
                method === 'PIX' ? '/api/v1/payment/session/pix' : '/api/v1/payment/session/creditCard',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: String(session._id),
                        personalInfo: payer,
                        ...(method === 'CREDIT_CARD' ? { cardInfo: card, idPagamento: 1 } : {}),
                    }),
                },
                60_000,
            );
            const payload = await readJsonResponse<{ paymentUrl?: string; message?: string }>(response);
            if (method === 'PIX' && payload?.paymentUrl) {
                window.location.assign(payload.paymentUrl);
                return;
            }
            setMessage(payload?.message || 'Cobrança criada. Aguardando confirmação.');
            await loadStatus();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Não foi possível criar a cobrança.');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <PageShell><AsyncStatePanel status="loading" message="Carregando participação remota..." /></PageShell>;
    if (!status) return <PageShell><AsyncStatePanel status="error" message={error || 'Não foi possível carregar a participação remota.'} onRetry={() => window.location.reload()} /></PageShell>;

    if (status.regularConfirmed) {
        return <PageShell><StatusBanner tone="info" title="Sua inscrição regular já está confirmada">Ela já permite submeter trabalhos. Não haverá cobrança remota adicional.</StatusBanner><Link className="mt-6 inline-flex font-bold text-[var(--cieps-red)] underline" href="/painel/trabalhos">Ir para trabalhos</Link></PageShell>;
    }

    if (status.access?.status === 'ACTIVE') {
        return (
            <PageShell className="flex items-center justify-center">
                <section className="w-full max-w-3xl rounded-lg border border-[var(--cieps-line)] bg-white p-8 shadow-[var(--cieps-shadow)]">
                    <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    <h1 className="mt-5 font-[family-name:var(--cieps-display)] text-3xl font-bold text-[var(--cieps-ink)]">Participação remota confirmada</h1>
                    <p className="mt-3 text-[var(--cieps-muted)]">Você pode enviar mais de um Trabalho Completo, respeitando os limites gerais e da modalidade.</p>
                    <div className="mt-6 flex flex-wrap gap-3"><Link href="/painel/trabalhos" className="rounded-md bg-[var(--cieps-red)] px-5 py-3 font-bold text-white">Ir para trabalhos</Link><Link href="/pagamentos" className="rounded-md border border-[var(--cieps-line)] px-5 py-3 font-bold text-[var(--cieps-ink)]">Comprar inscrição completa</Link></div>
                </section>
            </PageShell>
        );
    }

    if (status.access?.status === 'REVIEW_REQUIRED' || status.access?.status === 'REVOKED') {
        return (
            <PageShell>
                <StatusBanner tone="error" title="Participação remota bloqueada para revisão">
                    Não é possível abrir novas submissões enquanto o comprovante ou o pagamento estiver em revisão. Os trabalhos já enviados foram preservados e sinalizados para a equipe administrativa.
                </StatusBanner>
                <Link className="mt-6 inline-flex font-bold text-[var(--cieps-red)] underline" href="/painel/trabalhos">Consultar meus trabalhos</Link>
            </PageShell>
        );
    }

    const selectedMunicipality = municipalities.find((item) => item.code === municipalityCode);
    const accessReady = Boolean(status.access && ['ELIGIBLE', 'PAYMENT_PENDING'].includes(status.access.status));
    const paymentPending = Boolean(session && ['PAYMENT_PENDING', 'CREATING_PAYMENT', 'PAYMENT_REVIEW_REQUIRED'].includes(session.status));

    return (
        <PageShell>
            <div className="mx-auto w-full max-w-5xl py-8">
                <div className="flex items-start gap-4"><Laptop className="mt-1 h-9 w-9 text-[var(--cieps-red)]" /><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--cieps-red)]">I CIEPS 2026</p><h1 className="mt-2 font-[family-name:var(--cieps-display)] text-3xl font-bold text-[var(--cieps-ink)] md:text-4xl">Apresentação Remota de Trabalho</h1><p className="mt-3 max-w-3xl text-[var(--cieps-muted)]">Pagamento único de {formatCurrency(6000)} por usuário. Válido somente para Trabalho Completo e não inclui acesso presencial ao congresso.</p></div></div>
                {error && <div className="mt-6"><StatusBanner tone="error" title="Não foi possível continuar">{error}</StatusBanner></div>}
                {message && <div className="mt-6"><StatusBanner tone="success" title="Etapa concluída">{message}</StatusBanner></div>}

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <section className="rounded-lg border border-[var(--cieps-line)] bg-white p-6 shadow-sm">
                        <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--cieps-ink)]"><MapPin className="h-5 w-5" /> Elegibilidade e comprovante</h2>
                        {accessReady && <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Comprovante atual: {status.access?.proof.originalName} · {status.access?.municipalityName}/{status.access?.uf}</p>}
                        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">UF<select className={`${inputClass} mt-1`} value={uf} onChange={(event) => { setUf(event.target.value); setMunicipalityCode(''); }}><option value="">Selecione</option>{UFS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-semibold">Município<select className={`${inputClass} mt-1`} value={municipalityCode} onChange={(event) => setMunicipalityCode(event.target.value)} disabled={!uf}><option value="">Selecione</option>{municipalities.map((item) => <option key={item.code} value={item.code} disabled={!item.remoteEligible}>{item.name}{item.remoteEligible ? '' : ' - indisponível'}</option>)}</select></label></div>
                        {selectedMunicipality && !selectedMunicipality.remoteEligible && <p className="mt-3 text-sm font-semibold text-red-700">A participação remota não está disponível nessa cidade.</p>}
                        <label className="mt-5 block text-sm font-semibold"><span className="flex items-center gap-2"><FileUp className="h-4 w-4" /> Comprovante de endereço</span><input className={`${inputClass} mt-2`} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setProof(event.target.files?.[0] || null)} /></label>
                        <label className="mt-4 flex items-start gap-3 text-sm text-[var(--cieps-muted)]"><input className="mt-1" type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} /><span>Autorizo o tratamento deste comprovante exclusivamente para validar a participação remota e para auditoria administrativa.</span></label>
                        <Button className="mt-5 w-full" onClick={uploadProof} disabled={busy || Boolean(session) || !proof || !municipalityCode || !consentAccepted}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : session ? 'Comprovante vinculado à cobrança' : 'Salvar comprovante'}</Button>
                    </section>

                    <section className="rounded-lg border border-[var(--cieps-line)] bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-[var(--cieps-ink)]">Dados do pagador</h2>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <input className={`${inputClass} sm:col-span-2`} aria-label="Nome do pagador" placeholder="Nome completo" value={payer.name} onChange={(e) => setPayer({ ...payer, name: e.target.value })} />
                            <input className={inputClass} aria-label="E-mail do pagador" placeholder="E-mail" type="email" value={payer.email} onChange={(e) => setPayer({ ...payer, email: e.target.value })} />
                            <input className={inputClass} aria-label="CPF do pagador" placeholder="CPF" value={payer.cpfCnpj} onChange={(e) => setPayer({ ...payer, cpfCnpj: e.target.value })} />
                            <input className={inputClass} aria-label="CEP do pagador" placeholder="CEP" value={payer.postalCode} onChange={(e) => setPayer({ ...payer, postalCode: e.target.value })} />
                            <input className={inputClass} aria-label="Número do endereço" placeholder="Número" value={payer.addressNumber} onChange={(e) => setPayer({ ...payer, addressNumber: e.target.value })} />
                            <input className={inputClass} aria-label="Complemento" placeholder="Complemento (opcional)" value={payer.complement} onChange={(e) => setPayer({ ...payer, complement: e.target.value })} />
                            <input className={inputClass} aria-label="Telefone" placeholder="Telefone" value={payer.phone} onChange={(e) => setPayer({ ...payer, phone: e.target.value })} />
                        </div>
                        {!session && <Button className="mt-5 w-full" onClick={createSession} disabled={busy || !accessReady}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar para o pagamento'}</Button>}
                        {paymentPending && <StatusBanner tone="warning" title="Pagamento em processamento">A cobrança já foi criada. A página será atualizada quando a confirmação chegar.</StatusBanner>}
                        {session?.metodoPagamento === 'PIX' && session.paymentUrl && <a className="mt-4 inline-flex w-full justify-center rounded-md bg-[var(--cieps-red)] px-4 py-3 font-bold text-white" href={session.paymentUrl}>Abrir pagamento PIX</a>}
                    </section>
                </div>

                {session && session.status === 'OPEN' && (
                    <section className="mt-6 rounded-lg border border-[var(--cieps-line)] bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-[var(--cieps-ink)]">Forma de pagamento</h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setMethod('PIX')} className={`rounded-md border p-4 text-left ${method === 'PIX' ? 'border-[var(--cieps-red)] bg-red-50' : 'border-[var(--cieps-line)]'}`}><QrCode className="h-5 w-5" /><strong className="mt-2 block">PIX · {formatCurrency(6000)}</strong></button><button type="button" onClick={() => setMethod('CREDIT_CARD')} className={`rounded-md border p-4 text-left ${method === 'CREDIT_CARD' ? 'border-[var(--cieps-red)] bg-red-50' : 'border-[var(--cieps-line)]'}`}><CreditCard className="h-5 w-5" /><strong className="mt-2 block">Cartão · 1x de {formatCurrency(6000)}</strong></button></div>
                        {method === 'CREDIT_CARD' && <div className="mt-5 grid gap-3 sm:grid-cols-2"><input className={`${inputClass} sm:col-span-2`} autoComplete="cc-name" placeholder="Nome impresso no cartão" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /><input className={`${inputClass} sm:col-span-2`} autoComplete="cc-number" inputMode="numeric" placeholder="Número do cartão" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /><input className={inputClass} autoComplete="cc-exp" placeholder="MM/AA" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} /><input className={inputClass} autoComplete="cc-csc" inputMode="numeric" placeholder="CVV" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></div>}
                        <Button className="mt-5 w-full" onClick={pay} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : method === 'PIX' ? 'Gerar PIX' : 'Pagar com cartão'}</Button>
                    </section>
                )}
            </div>
        </PageShell>
    );
}
