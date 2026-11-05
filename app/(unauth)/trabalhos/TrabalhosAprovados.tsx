'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Award, FileText, Presentation, Search } from 'lucide-react';
import { Modal } from '@/components/cieps';
import { ARTIGOS_APROVADOS, POSTERES_APROVADOS, TRABALHOS_ATUALIZADOS_EM } from './aprovados';

type Lista = {
  id: 'posteres' | 'artigos';
  titulo: string;
  formato: string;
  itens: string[];
};

const LISTAS: Lista[] = [
  { id: 'posteres', titulo: 'Pôsteres aprovados', formato: 'Resumo simples · apresentação em pôster', itens: POSTERES_APROVADOS },
  { id: 'artigos', titulo: 'Artigos originais aprovados', formato: 'Trabalho completo · apresentação oral', itens: ARTIGOS_APROVADOS },
];

const PREVIA = 4;

// Busca sem acento e sem diferença de maiúsculas, já que boa parte dos títulos está em caixa alta.
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function TrabalhosAprovados() {
  const [aberta, setAberta] = useState<Lista | null>(null);
  const [busca, setBusca] = useState('');
  const total = POSTERES_APROVADOS.length + ARTIGOS_APROVADOS.length;
  const pctPosteres = (POSTERES_APROVADOS.length / total) * 100;

  const filtrados = useMemo(() => {
    if (!aberta) return [];
    const termo = normalizar(busca.trim());
    return aberta.itens
      .map((titulo, index) => ({ titulo, numero: index + 1 }))
      .filter(({ titulo }) => !termo || normalizar(titulo).includes(termo));
  }, [aberta, busca]);

  const abrir = (lista: Lista) => {
    setBusca('');
    setAberta(lista);
  };

  return (
    <section className="trabalhos-aprovados" aria-labelledby="trabalhos-aprovados-titulo">
      <div className="trabalhos-section-heading">
        <span className="cieps-kicker">Resultado</span>
        <h2 id="trabalhos-aprovados-titulo" className="cieps-display">Trabalhos aprovados.</h2>
      </div>

      <div className="trabalhos-aprovados-grid">
        <article className="cieps-surface aprovados-resumo">
          <Award size={24} aria-hidden="true" />
          <strong className="aprovados-numero cieps-display">{total}</strong>
          <span className="aprovados-legenda">trabalhos aprovados para o I CIEPS</span>
          <div className="aprovados-barra" role="img" aria-label={`${POSTERES_APROVADOS.length} pôsteres e ${ARTIGOS_APROVADOS.length} artigos originais`}>
            <span className="is-posteres" style={{ width: `${pctPosteres}%` }} />
            <span className="is-artigos" style={{ width: `${100 - pctPosteres}%` }} />
          </div>
          <ul className="aprovados-divisao">
            <li><i className="is-posteres" aria-hidden="true" />{POSTERES_APROVADOS.length} pôsteres</li>
            <li><i className="is-artigos" aria-hidden="true" />{ARTIGOS_APROVADOS.length} artigos originais</li>
          </ul>
          <small>Lista atualizada em {TRABALHOS_ATUALIZADOS_EM}.</small>
        </article>

        {LISTAS.map((lista) => {
          const Icone = lista.id === 'posteres' ? Presentation : FileText;
          return (
            <article key={lista.id} className={`cieps-surface aprovados-lista is-${lista.id}`}>
              <header>
                <span className="aprovados-icone"><Icone size={20} aria-hidden="true" /></span>
                <div>
                  <h3>{lista.titulo}</h3>
                  <span>{lista.formato}</span>
                </div>
                <strong className="aprovados-contagem cieps-display">{lista.itens.length}</strong>
              </header>
              <ol className="aprovados-previa">
                {lista.itens.slice(0, PREVIA).map((titulo) => <li key={titulo}><span>{titulo}</span></li>)}
              </ol>
              <button type="button" className="cieps-button-outline aprovados-ver-todos" onClick={() => abrir(lista)} aria-haspopup="dialog">
                Ver os {lista.itens.length} trabalhos <ArrowRight size={16} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </div>

      <Modal
        open={Boolean(aberta)}
        onClose={() => setAberta(null)}
        title={aberta?.titulo ?? 'Trabalhos aprovados'}
        description={aberta ? `${aberta.formato} · ${aberta.itens.length} trabalhos, em ordem alfabética.` : undefined}
        className="aprovados-modal"
      >
        <label className="aprovados-busca">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar pelo título"
            aria-label="Buscar trabalho pelo título"
          />
        </label>
        <p className="aprovados-resultado" aria-live="polite">
          {filtrados.length} de {aberta?.itens.length ?? 0} trabalhos
        </p>
        {filtrados.length ? (
          <ol className="aprovados-lista-completa">
            {filtrados.map(({ titulo, numero }) => (
              <li key={numero}><span>{numero}</span>{titulo}</li>
            ))}
          </ol>
        ) : (
          <p className="aprovados-vazio">Nenhum título encontrado. Tente outra palavra.</p>
        )}
      </Modal>
    </section>
  );
}
