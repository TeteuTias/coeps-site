'use client';

import { useId, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Download, MapPin, Mic, Presentation, Search } from 'lucide-react';
import {
  APRESENTACOES_ORAIS,
  ORAL_DURACAO_MIN,
  POSTERES_07_09,
  POSTERES_09_11,
  PROGRAMACAO_DATA,
  PROGRAMACAO_PDF_URL,
  SALAS,
  terminoOral,
  type ApresentacaoOral,
  type Poster,
} from './programacao';

type AbaId = 'oral' | 'poster-pares' | 'poster-impares';

const ABAS: { id: AbaId; titulo: string; horario: string; regra: string }[] = [
  { id: 'oral', titulo: 'Apresentação oral', horario: '07h00 – 11h00', regra: `${ORAL_DURACAO_MIN} min por trabalho · ${SALAS.length} salas simultâneas` },
  { id: 'poster-pares', titulo: 'Pôster', horario: '07h00 – 09h00', regra: 'Painéis pares: 02, 04, 06…' },
  { id: 'poster-impares', titulo: 'Pôster', horario: '09h00 – 11h00', regra: 'Painéis ímpares: 01, 03, 05…' },
];

// Busca sem acento e sem diferença de maiúsculas, já que boa parte dos títulos está em caixa alta.
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const painel = (numero: number) => String(numero).padStart(2, '0');

const textoOral = (item: ApresentacaoOral) => normalizar(`${item.titulo} ${item.apresentador} ${item.codigo} sala ${item.sala} ${item.inicio}`);
const textoPoster = (item: Poster) => normalizar(`${item.titulo} ${item.apresentador} ${item.codigo} painel ${painel(item.painel)}`);

export default function ProgramacaoApresentacoes() {
  const [aba, setAba] = useState<AbaId>('oral');
  const [busca, setBusca] = useState('');
  const baseId = useId();
  const termo = normalizar(busca.trim());

  const resultados = useMemo(() => ({
    oral: APRESENTACOES_ORAIS.filter((item) => !termo || textoOral(item).includes(termo)),
    'poster-pares': POSTERES_07_09.filter((item) => !termo || textoPoster(item).includes(termo)),
    'poster-impares': POSTERES_09_11.filter((item) => !termo || textoPoster(item).includes(termo)),
  }), [termo]);

  const horarios = useMemo(() => {
    const porHorario = new Map<string, ApresentacaoOral[]>();
    for (const item of resultados.oral) porHorario.set(item.inicio, [...(porHorario.get(item.inicio) ?? []), item]);
    return [...porHorario.entries()];
  }, [resultados.oral]);

  const ativos = resultados[aba];
  const outrasAbas = ABAS.filter((outra) => outra.id !== aba && resultados[outra.id].length > 0);

  return (
    <section className="programacao" id="programacao" aria-labelledby={`${baseId}-titulo`}>
      <header className="programacao-cabecalho">
        <div className="trabalhos-section-heading">
          <span className="cieps-kicker"><CalendarDays size={14} aria-hidden="true" /> {PROGRAMACAO_DATA}</span>
          <h2 id={`${baseId}-titulo`} className="cieps-display">Programação de apresentações.</h2>
          <p>
            Confira primeiro o horário. Depois, procure a sala (apresentação oral) ou o número do painel (pôster).
          </p>
        </div>
        <a href={PROGRAMACAO_PDF_URL} target="_blank" rel="noopener noreferrer" className="cieps-button-outline">
          <Download size={18} aria-hidden="true" />Baixar PDF
        </a>
      </header>

      <div className="programacao-abas" role="tablist" aria-label="Modalidade e turno">
        {ABAS.map((item) => {
          const Icone = item.id === 'oral' ? Mic : Presentation;
          const total = resultados[item.id].length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-aba-${item.id}`}
              aria-selected={aba === item.id}
              aria-controls={`${baseId}-painel`}
              className={`programacao-aba is-${item.id}`}
              onClick={() => setAba(item.id)}
            >
              <span className="programacao-aba-icone"><Icone size={20} aria-hidden="true" /></span>
              <span className="programacao-aba-texto">
                <strong>{item.titulo}</strong>
                <span><Clock3 size={14} aria-hidden="true" />{item.horario}</span>
                <small>{item.regra}</small>
              </span>
              <span className="programacao-aba-total cieps-display" aria-label={termo ? `${total} resultados` : `${total} trabalhos`}>
                {total}
              </span>
            </button>
          );
        })}
      </div>

      <label className="aprovados-busca programacao-busca">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Nome, título, código ou painel"
          aria-label="Buscar apresentação por nome, título, código ou painel"
        />
      </label>

      <div
        className={`cieps-surface programacao-painel is-${aba}`}
        role="tabpanel"
        id={`${baseId}-painel`}
        aria-labelledby={`${baseId}-aba-${aba}`}
      >
        <p className="aprovados-resultado" aria-live="polite">
          {termo ? `${ativos.length} resultado${ativos.length === 1 ? '' : 's'} nesta lista` : aba === 'oral' ? 'Em ordem de horário e sala.' : 'Em ordem de painel.'}
        </p>

        {ativos.length === 0 ? (
          <div className="programacao-vazio">
            <p>Nenhuma apresentação encontrada nesta lista.</p>
            {outrasAbas.length > 0 && (
              <div className="programacao-vazio-acoes">
                {outrasAbas.map((outra) => (
                  <button key={outra.id} type="button" className="cieps-button-outline" onClick={() => setAba(outra.id)}>
                    Ver {resultados[outra.id].length} em {outra.titulo} · {outra.horario}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : aba === 'oral' ? (
          <ol className="programacao-horarios">
            {horarios.map(([inicio, itens]) => (
              <li key={inicio} className="programacao-horario">
                <div className="programacao-hora">
                  <strong className="cieps-display">{inicio}</strong>
                  <span>até {terminoOral(inicio)}</span>
                </div>
                <div className="programacao-salas">
                  {itens.map((item) => (
                    <article key={item.codigo} className="programacao-card" style={{ gridColumn: item.sala }}>
                      <span className="programacao-local"><MapPin size={14} aria-hidden="true" />Sala {item.sala}</span>
                      <h3>{item.titulo}</h3>
                      <p>{item.apresentador}</p>
                      <small>{item.codigo}</small>
                    </article>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="programacao-posteres">
            {(ativos as Poster[]).map((item) => (
              <li key={item.codigo} className="programacao-poster">
                <span className="programacao-painel-numero cieps-display" aria-label={`Painel ${painel(item.painel)}`}>
                  {painel(item.painel)}
                </span>
                <div>
                  <h3>{item.titulo}</h3>
                  <p>{item.apresentador}</p>
                  <small>{item.codigo}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
