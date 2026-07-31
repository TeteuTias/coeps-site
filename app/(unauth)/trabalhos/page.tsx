'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, StatusBanner } from '@/components/cieps';
import { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';
import { ArrowRight, CalendarDays, Compass, ExternalLink, FileText, Loader2, Send, Sparkles } from 'lucide-react';
import './style.css';

function formatShortDate(value?: string) {
  if (!value) return '--/--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--/--';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

async function requestWorksConfig() {
  const response = await fetchWithTimeout('/api/inauthenticated/get/trabalhosConfig', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<IAcademicWorksProps>;
}

export default function Trabalhos() {
  const [config, setConfig] = useState<IAcademicWorksProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfig(await requestWorksConfig());
    } catch {
      setConfig(null);
      setError('As informações de submissão não puderam ser consultadas agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestWorksConfig()
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch(() => {
        if (active) {
          setConfig(null);
          setError('As informações de submissão não puderam ser consultadas agora.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="trabalhos-page">
      <section className="trabalhos-hero">
        <div>
          <span className="cieps-kicker">Trabalhos científicos</span>
          <h1 className="cieps-display">Pesquisa com rosto, contexto e alcance internacional.</h1>
          <p>
            O I CIEPS recebe produções acadêmicas voltadas à saúde, à educação e ao cuidado. A
            1ª Edição Internacional amplia a conversa sem perder o rigor e a clareza do processo.
          </p>
        </div>
        <aside className="trabalhos-hero-card cieps-surface">
          <Sparkles size={22} aria-hidden="true" />
          <strong>{config?.isOpen ? 'Submissões abertas' : 'Edital em acompanhamento'}</strong>
          <span>{loading ? 'Verificando o status atual.' : config?.isOpen ? 'Envie seu trabalho e acompanhe os prazos.' : 'A página permanece pronta para novas atualizações.'}</span>
        </aside>
      </section>

      {error && (
        <StatusBanner
          tone="error"
          title="Informações temporariamente indisponíveis"
          action={<Button variant="outline" onClick={fetchConfig}>Tentar novamente</Button>}
        >
          {error}
        </StatusBanner>
      )}

      <section className="trabalhos-status-grid">
        <article className="cieps-surface trabalhos-status-card">
          <span className="cieps-kicker">Status</span>
          {loading ? (
            <div className="trabalhos-inline-state" role="status"><Loader2 className="spin" size={18} aria-hidden="true" /><strong>Carregando informações</strong></div>
          ) : (
            <strong>{config?.isOpen ? 'Submissões abertas' : 'Submissões encerradas'}</strong>
          )}
          <p>{error ? 'Tente novamente para consultar os detalhes oficiais.' : config?.isOpen ? 'Consulte edital, guia e painel do participante para enviar.' : 'Os resultados e as próximas chamadas seguem publicados nesta página.'}</p>
        </article>
        <article className="cieps-surface trabalhos-date-card"><CalendarDays size={20} aria-hidden="true" /><strong>{formatShortDate(config?.data_limite_submissao)}</strong><span>Prazo de submissão</span></article>
        <article className="cieps-surface trabalhos-date-card"><CalendarDays size={20} aria-hidden="true" /><strong>{formatShortDate(config?.data_publicacao_resultados)}</strong><span>Publicação de resultados</span></article>
      </section>

      <section className="trabalhos-content-grid">
        <article className="cieps-surface trabalhos-copy-card">
          <span className="cieps-kicker">Convite acadêmico</span>
          <h2 className="cieps-display">Um congresso que transforma leitura em autoria.</h2>
          <p>
            O Diretório Acadêmico Diogo Guimarães, junto ao IMEPAC Araguari, organiza o I Congresso
            Internacional de Estudantes e Profissionais da Saúde para receber estudos inéditos e relevantes.
          </p>
          <p>
            A submissão permanece centralizada no painel do congressista, com materiais de apoio publicados
            nesta página sempre que estiverem disponíveis.
          </p>
          {config?.isOpen && (
            <div className="trabalhos-action-row">
              {config.link_edital && <Link href={config.link_edital} target="_blank" rel="noopener noreferrer" className="cieps-button-outline"><FileText size={18} aria-hidden="true" />Ver edital</Link>}
              {config.link_guia && <Link href={config.link_guia} target="_blank" rel="noopener noreferrer" className="cieps-button-outline"><Compass size={18} aria-hidden="true" />Ver guia</Link>}
              <Link href="/painel/trabalhos" className="cieps-button"><Send size={18} aria-hidden="true" />Enviar trabalho</Link>
            </div>
          )}
        </article>

        <article className="cieps-surface trabalhos-publicacoes">
          <div className="trabalhos-section-heading"><span className="cieps-kicker">Publicações</span><h2 className="cieps-display">Resultados e documentos liberados.</h2></div>
          {loading ? (
            <div className="trabalhos-inline-state" role="status"><Loader2 className="spin" size={18} aria-hidden="true" /><strong>Carregando publicações</strong></div>
          ) : config?.resultados?.length ? (
            <div className="trabalhos-publication-list">
              {config.resultados.map((publication) => (
                <Link key={publication.link} href={publication.link} target="_blank" rel="noopener noreferrer"><FileText size={18} aria-hidden="true" /><span>{publication.titulo}</span><ExternalLink size={16} aria-hidden="true" /></Link>
              ))}
            </div>
          ) : (
            <p>{error ? 'Recarregue para consultar as publicações.' : 'As publicações oficiais serão exibidas aqui assim que forem disponibilizadas.'}</p>
          )}
          <Link href="/anais" className="trabalhos-more-link">Consultar anais <ArrowRight size={16} aria-hidden="true" /></Link>
        </article>
      </section>
    </main>
  );
}
