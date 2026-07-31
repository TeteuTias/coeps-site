'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, QrCode } from 'lucide-react';
import { AsyncStatePanel, ButtonLink, PageShell, SectionHeading, StatusBanner } from '@/components/cieps';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';
import './style.css';

interface UsuarioQR {
  id: string;
  nome: string;
  email: string;
  qrCode: string;
}

async function requestQrCode() {
  const response = await fetchWithTimeout('/api/get/qrCode', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Não foi possível gerar o QR Code.');
  }
  if (!payload?.id || !payload?.qrCode) throw new Error('O QR Code retornado é inválido.');
  return payload as UsuarioQR;
}

export default function MeuQRCodePage() {
  const { id } = useParams<{ id: string }>();
  const [dados, setDados] = useState<UsuarioQR | null>(null);
  const [erro, setErro] = useState<string | null>(id === 'null' ? 'Identificação do congressista indisponível.' : null);
  const [loading, setLoading] = useState(id !== 'null');

  const buscarQR = useCallback(async () => {
    if (!id || id === 'null') {
      setErro('Identificação do congressista indisponível.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro(null);
    try {
      const result = await requestQrCode();
      if (result.id !== id) throw new Error('Este QR Code não corresponde ao congressista autenticado.');
      setDados(result);
    } catch (requestError) {
      setDados(null);
      setErro(requestError instanceof Error ? requestError.message : 'Não foi possível gerar o QR Code.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || id === 'null') return;
    let active = true;
    void requestQrCode()
      .then((result) => {
        if (!active) return;
        if (result.id !== id) throw new Error('Este QR Code não corresponde ao congressista autenticado.');
        setDados(result);
      })
      .catch((requestError) => {
        if (active) setErro(requestError instanceof Error ? requestError.message : 'Não foi possível gerar o QR Code.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <PageShell className="qr-main">
      <SectionHeading
        kicker="Acesso ao evento"
        title="Seu QR Code"
        description="Apresente este código no credenciamento e mantenha seus dados de acesso protegidos."
        action={<ButtonLink href="/painel" variant="outline"><ArrowLeft size={18} aria-hidden="true" />Voltar ao painel</ButtonLink>}
      />

      <section className="mt-5">
        {loading ? (
          <AsyncStatePanel status="loading" loadingTitle="Gerando seu QR Code" />
        ) : erro ? (
          <AsyncStatePanel status="error" errorTitle="QR Code indisponível" message={erro} onRetry={buscarQR} />
        ) : dados ? (
          <article className="qr-card mx-auto max-w-xl rounded-lg border border-linha bg-white p-6 shadow-[var(--cieps-shadow)] sm:p-10">
            <div className="mx-auto w-full max-w-[320px] rounded-md border border-linha bg-white p-3">
              <Image src={dados.qrCode} alt={`QR Code de ${dados.nome}`} width={320} height={320} unoptimized className="h-auto w-full" />
            </div>
            <div className="mt-6 space-y-2 rounded-md border border-linha bg-papel p-4 text-sm text-tinta">
              <p><strong>Nome:</strong> {dados.nome}</p>
              <p><strong>E-mail:</strong> {dados.email}</p>
              <p className="break-all"><strong>ID:</strong> {dados.id}</p>
            </div>
            <StatusBanner tone="warning" title="Uso pessoal" className="mt-4">
              Não compartilhe este código. Ele identifica sua inscrição no evento.
            </StatusBanner>
          </article>
        ) : (
          <AsyncStatePanel status="empty" emptyTitle="QR Code ainda não disponível" message="Conclua sua inscrição ou procure a organização." />
        )}
      </section>
      <span className="sr-only"><QrCode aria-hidden="true" /></span>
    </PageShell>
  );
}
