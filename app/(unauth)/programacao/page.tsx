'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ICourse, ILecture } from '@/lib/types/events/event.t';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';
import { AsyncStatePanel, Modal, StatusBanner } from '@/components/cieps';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  GraduationCap,
  Loader2,
  MapPin,
  Presentation,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import './style.css';

type ProgramItem = ICourse | ILecture;
type OrganizedData = Record<string, ProgramItem[]>;
const CURRENT_EDITION_YEAR = 2026;

const scheduleHighlights = [
  { day: '12 NOV', label: 'Abertura oficial' },
  { day: '13 NOV', label: 'Mesas e conferências' },
  { day: '14 NOV', label: 'Minicursos e vivências' },
  { day: '15 NOV', label: 'Encerramento e conexões' },
];

function organizeData(course: ICourse[], lecture: ILecture[]) {
  const currentEditionItems = [...course, ...lecture].filter((item) => {
    const validDates = (item.timeline ?? [])
      .map((slot) => parseDate(slot.date_init))
      .filter((date): date is Date => Boolean(date));
    return validDates.length === 0 || validDates.some((date) => date.getFullYear() === CURRENT_EDITION_YEAR);
  });

  return currentEditionItems.reduce<OrganizedData>((groups, item) => {
    const category = item.type || 'Programação';
    groups[category] ??= [];
    groups[category].push(item);
    return groups;
  }, {});
}

function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('curso') || normalized.includes('minicurso') || normalized.includes('workshop')) {
    return <GraduationCap size={20} aria-hidden="true" />;
  }
  if (normalized.includes('palestra') || normalized.includes('conferência') || normalized.includes('mesa')) {
    return <Presentation size={20} aria-hidden="true" />;
  }
  if (normalized.includes('atividade') || normalized.includes('vivência')) {
    return <Sparkles size={20} aria-hidden="true" />;
  }
  return <CalendarDays size={20} aria-hidden="true" />;
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string) {
  return parseDate(value)?.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) ?? 'Data a confirmar';
}

function formatTime(value?: string) {
  return parseDate(value)?.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }) ?? '--:--';
}

async function requestProgramacao() {
  const response = await fetchWithTimeout('/api/inauthenticated/get/programacao', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result: { result1?: ICourse[]; result2?: ILecture[] } = await response.json();
  return { course: result.result1 ?? [], lecture: result.result2 ?? [] };
}

export default function Programacao() {
  const [data, setData] = useState<{ course: ICourse[]; lecture: ILecture[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<ProgramItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await requestProgramacao());
    } catch {
      setData(null);
      setError('A programação não pôde ser consultada agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestProgramacao()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setError('A programação não pôde ser consultada agora.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const organizedData = useMemo(
    () => organizeData(data?.course ?? [], data?.lecture ?? []),
    [data],
  );
  const categories = Object.entries(organizedData);

  return (
    <main className="programacao-page">
      <section className="programacao-hero">
        <div className="programacao-hero-copy">
          <span className="cieps-kicker">Programação oficial</span>
          <h1 className="cieps-display">Quatro dias para viver o I CIEPS.</h1>
          <p>
            De 12 a 15 de novembro de 2026, Araguari recebe uma agenda pensada para quem quer
            estudar, trocar experiências e acompanhar a 1ª Edição Internacional de perto.
          </p>
          <div className="programacao-highlight-grid">
            {scheduleHighlights.map((highlight) => (
              <article key={highlight.day}>
                <strong>{highlight.day}</strong>
                <span>{highlight.label}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="programacao-hero-media">
          <Image
            src="/cieps/cieps-program-booklet.png"
            alt="Programa editorial do I CIEPS com a identidade visual do congresso"
            width={960}
            height={720}
            priority
          />
        </div>
      </section>

      <section className="programacao-status cieps-surface">
        {loading ? (
          <div className="programacao-state" role="status">
            <Loader2 className="spin" size={22} aria-hidden="true" />
            <strong>Carregando programação</strong>
            <span>Organizando as atividades disponíveis.</span>
          </div>
        ) : error ? (
          <StatusBanner tone="error" title="Programação temporariamente indisponível">
            Use a opção de tentar novamente abaixo.
          </StatusBanner>
        ) : categories.length > 0 ? (
          <div className="programacao-state" role="status">
            <UsersRound size={22} aria-hidden="true" />
            <strong>Agenda pronta para consulta</strong>
            <span>Abra uma categoria e selecione o evento para ver os detalhes.</span>
          </div>
        ) : (
          <div className="programacao-state" role="status">
            <Clock3 size={22} aria-hidden="true" />
            <strong>Cronograma em atualização</strong>
            <span>Os blocos oficiais serão publicados aqui assim que forem liberados.</span>
          </div>
        )}
      </section>

      <section className="programacao-board" aria-label="Agenda do congresso">
        {loading ? (
          <AsyncStatePanel status="loading" loadingTitle="Organizando a programação" />
        ) : error ? (
          <AsyncStatePanel status="error" message={error} onRetry={fetchData} />
        ) : categories.length > 0 ? (
          categories.map(([category, items], index) => {
            const collapsed = collapsedCategories[category] ?? false;
            return (
              <article key={category} className={`programacao-category cieps-surface tone-${(index % 4) + 1}`}>
                <button
                  type="button"
                  className="programacao-category-header"
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsedCategories((current) => ({ ...current, [category]: !current[category] }))}
                >
                  <span className="programacao-category-title">{getCategoryIcon(category)}<span>{category}</span></span>
                  <span className="programacao-category-meta">
                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                    {collapsed ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
                  </span>
                </button>
                {!collapsed && (
                  <div className="programacao-event-list">
                    {items.map((item) => {
                      const firstTimeline = item.timeline?.[0];
                      return (
                        <button
                          key={String(item._id)}
                          type="button"
                          className="programacao-event"
                          onClick={() => setOpenItem(item)}
                          aria-haspopup="dialog"
                        >
                          <div><strong>{item.name}</strong><span>{item.type}</span></div>
                          <div className="programacao-event-time"><CalendarDays size={16} aria-hidden="true" /><span>{formatDate(firstTimeline?.date_init)}</span></div>
                          <div className="programacao-event-time"><Clock3 size={16} aria-hidden="true" /><span>{formatTime(firstTimeline?.date_init)} - {formatTime(firstTimeline?.date_end)}</span></div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="programacao-empty cieps-surface">
            <span className="cieps-kicker">Em breve</span>
            <h2 className="cieps-display">A agenda detalhada aparecerá aqui.</h2>
            <p>Enquanto isso, o período oficial já está definido: Araguari, 12 a 15 de novembro de 2026.</p>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(openItem)}
        onClose={() => setOpenItem(null)}
        title={openItem?.name ?? 'Detalhes da atividade'}
        description={openItem?.description || 'Descrição oficial em atualização.'}
      >
        {openItem && (
          <div className="programacao-modal-timeline">
            {openItem.timeline?.length ? openItem.timeline.map((timeline) => (
              <section key={String(timeline._id)} className="programacao-modal-slot">
                <strong>{timeline.name || 'Atividade'}</strong>
                <span><CalendarDays size={15} aria-hidden="true" />{formatDate(timeline.date_init)}</span>
                <span><Clock3 size={15} aria-hidden="true" />{formatTime(timeline.date_init)} - {formatTime(timeline.date_end)}</span>
                <span><MapPin size={15} aria-hidden="true" />{timeline.local || 'Local a confirmar'}{timeline.local_description ? ` - ${timeline.local_description}` : ''}</span>
                {timeline.description && <p>{timeline.description}</p>}
              </section>
            )) : (
              <StatusBanner tone="info" title="Horário em definição">
                A organização publicará os detalhes desta atividade em breve.
              </StatusBanner>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
