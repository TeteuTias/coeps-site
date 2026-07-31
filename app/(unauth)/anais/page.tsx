'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AsyncStatePanel } from '@/components/cieps';
import { IConferenceProceedings } from '@/lib/types/conferenceProceedings/conferenceProceedings.t';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';
import { BookOpen, ExternalLink, FileText, Loader2, Mail, Phone } from 'lucide-react';
import './style.css';

const publicationMedia = [
  '/cieps/anais-blue-book.png',
  '/cieps/anais-open-spread.png',
  '/cieps/anais-paper-stack.png',
];

function publicationYear(value?: string) {
  if (!value) return 'Ano a confirmar';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Ano a confirmar' : String(date.getFullYear());
}

async function requestAnais() {
  const response = await fetchWithTimeout('/api/inauthenticated/get/anais', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: { data?: IConferenceProceedings[] } = await response.json();
  return [...(data.data ?? [])].sort(
    (a, b) => new Date(b.date_update).getTime() - new Date(a.date_update).getTime(),
  );
}

export default function Anais() {
  const [anais, setAnais] = useState<IConferenceProceedings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnais = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnais(await requestAnais());
    } catch {
      setAnais([]);
      setError('Os anais não puderam ser consultados agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestAnais()
      .then((result) => {
        if (active) setAnais(result);
      })
      .catch(() => {
        if (active) {
          setAnais([]);
          setError('Os anais não puderam ser consultados agora.');
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
    <main className="anais-page">
      <section className="anais-hero">
        <div>
          <span className="cieps-kicker">Memória científica</span>
          <h1 className="cieps-display">Anais do CIEPS, organizados para consulta clara.</h1>
          <p>
            Esta área reúne as publicações do congresso em um formato direto, preservando a
            produção científica das edições anteriores e preparando o caminho para o I CIEPS.
          </p>
        </div>
        <Image src="/cieps/anais-blue-book.png" width={560} height={420} alt="Livro de anais do CIEPS" loading="eager" />
      </section>

      <section className="anais-status cieps-surface" role="status">
        {loading ? (
          <><Loader2 className="spin" size={20} aria-hidden="true" /><strong>Carregando publicações</strong><span>Preparando os volumes disponíveis.</span></>
        ) : error ? (
          <><FileText size={20} aria-hidden="true" /><strong>Publicações indisponíveis</strong><span>Tente novamente abaixo.</span></>
        ) : anais.length > 0 ? (
          <><BookOpen size={20} aria-hidden="true" /><strong>{anais.length === 1 ? '1 publicação disponível' : `${anais.length} publicações disponíveis`}</strong><span>Abra um volume para acessar o arquivo oficial.</span></>
        ) : (
          <><FileText size={20} aria-hidden="true" /><strong>Novos anais ainda não publicados</strong><span>Assim que houver liberação, os arquivos aparecerão aqui.</span></>
        )}
      </section>

      <section className="anais-grid" aria-label="Publicações disponíveis">
        {loading ? (
          <AsyncStatePanel status="loading" loadingTitle="Preparando os anais" />
        ) : error ? (
          <AsyncStatePanel status="error" message={error} onRetry={fetchAnais} />
        ) : anais.length > 0 ? (
          anais.map((item, index) => (
            <Link
              key={item.link}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="anais-card cieps-surface"
            >
              <div className="anais-card-cover">
                <Image src={publicationMedia[index % publicationMedia.length]} width={320} height={220} alt={`Imagem editorial relacionada a ${item.name}`} />
              </div>
              <div className="anais-card-copy">
                <strong>{item.name}</strong>
                <span>{publicationYear(item.date_update)}</span>
                <small>Abrir publicação <ExternalLink size={14} aria-hidden="true" /></small>
              </div>
            </Link>
          ))
        ) : (
          <article className="anais-empty cieps-surface">
            <span className="cieps-kicker">Em breve</span>
            <h2 className="cieps-display">Os próximos volumes estarão disponíveis aqui quando forem liberados.</h2>
            <p>Consulte os comunicados oficiais do congresso para acompanhar novidades.</p>
          </article>
        )}
      </section>

      <section className="anais-contact cieps-surface">
        <div><span className="cieps-kicker">Contato</span><h2 className="cieps-display">Precisa confirmar uma publicação?</h2></div>
        <div className="anais-contact-list">
          <a href="mailto:dadg.imepac@gmail.com"><Mail size={18} aria-hidden="true" />dadg.imepac@gmail.com</a>
          <a href="https://api.whatsapp.com/send?phone=5562983306426" target="_blank" rel="noopener noreferrer"><Phone size={18} aria-hidden="true" />+55 34 99120-9359</a>
        </div>
      </section>
    </main>
  );
}
