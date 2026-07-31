'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, FileCheck2 } from 'lucide-react';
import { AsyncStatePanel, Button } from '@/components/cieps';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';

async function requestParticipantName() {
  const response = await fetchWithTimeout('/api/get/usuariosInformacoes', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível consultar os dados do congressista.');
  const payload = await readJsonResponse<{
    data?: { informacoes_usuario?: { nome?: string } };
  }>(response);
  const name = payload?.data?.informacoes_usuario?.nome;
  if (!name || typeof name !== 'string') throw new Error('O nome do congressista ainda não está disponível.');
  return name;
}

export default function ComprovanteDeInscricao() {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadName = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setName(await requestParticipantName());
    } catch (requestError) {
      setName(null);
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o comprovante.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestParticipantName()
      .then((result) => {
        if (active) setName(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o comprovante.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDownloadPdf = async () => {
    const element = document.getElementById('document-content');
    if (!element || !name || generating) return;

    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const options = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: 'comprovante-inscricao-cieps.pdf',
        image: { type: 'png' as const, quality: 1 },
        html2canvas: { scale: 2, logging: false, dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      };
      await html2pdf().set(options).from(element).save();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="cieps-receipt-page">
      <section className="cieps-receipt-heading">
        <div>
          <span className="cieps-kicker">Documento do congressista</span>
          <h1 className="cieps-display">Comprovante de inscrição</h1>
          <p>Confira os dados abaixo e gere uma cópia em PDF para seus registros.</p>
        </div>
        <Button onClick={handleDownloadPdf} disabled={!name} loading={generating}>
          <Download size={20} aria-hidden="true" />
          {generating ? 'Gerando PDF' : 'Baixar em PDF'}
        </Button>
      </section>

      <section className="cieps-receipt-preview">
        <div className="cieps-receipt-preview-label"><FileCheck2 size={18} aria-hidden="true" />Pré-visualização</div>
        {loading ? (
          <AsyncStatePanel status="loading" loadingTitle="Preparando seu comprovante" />
        ) : error ? (
          <AsyncStatePanel status="error" errorTitle="Comprovante indisponível" message={error} onRetry={loadName} />
        ) : name ? (
          <div id="document-content" className="document-preview">
            <div className="mb-8 text-center">
              <Image src="/documento-anexado.png" alt="Marca do I CIEPS" width={580} height={180} className="mx-auto h-auto max-w-[300px]" />
            </div>
            <h2 className="cieps-display mb-5 text-center text-2xl font-semibold text-tinta">Comprovante de participação no I CIEPS</h2>
            <p className="text-justify font-serif text-base leading-7 text-tinta">
              Certificamos que <strong>{name}</strong> está devidamente inscrito(a) para participar do
              I Congresso Internacional de Estudantes e Profissionais da Saúde, realizado em Araguari,
              de 12 a 15 de novembro de 2026.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
