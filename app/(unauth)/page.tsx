'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Globe2, Presentation, Star, UsersRound } from 'lucide-react';
import './style.home.css';

const metrics = [
  {
    icon: UsersRound,
    value: '700+',
    label: 'participantes presenciais',
  },
  {
    icon: Presentation,
    value: '40+',
    label: 'minicursos práticos',
  },
  {
    icon: Globe2,
    value: '01',
    label: 'edição internacional',
  },
  {
    icon: BookOpen,
    value: '08',
    label: 'edições de história',
  },
];

const programacao = [
  ['12 nov', 'Abertura oficial', 'Palavra magna e simpósios'],
  ['13 nov', 'Mesas-redondas', 'Comunicações orais e workshops'],
  ['14 nov', 'Minicursos', 'Vivências e sessões temáticas'],
  ['15 nov', 'Encerramento', 'Apresentações finais e celebração'],
];

export default function Home() {
  return (
    <main className="cieps-home">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="cieps-kicker">A virada de 2026</span>
          <h1 className="cieps-display">I CIEPS</h1>
          <p className="landing-hero-edition">1ª Edição Internacional</p>
          <div className="cieps-lines" aria-hidden="true" />
          <p className="landing-hero-description">
            O maior congresso estudantil de saúde da região entra em uma nova fase.
            Tradição que inspira, ciência que conecta e experiências que transformam.
          </p>
          <div className="landing-hero-actions">
            <Link href="/inscricoes" prefetch={false} className="cieps-button">
              Faça sua inscrição
            </Link>
            <Link href="/programacao" prefetch={false} className="cieps-button-outline">
              Ver programação
            </Link>
          </div>
        </div>

        <div className="landing-hero-media">
          <div className="landing-hero-photo">
            <Image
              src="/cieps/cieps-landing-panel.png"
              unoptimized={true}
              alt="Arte panorâmica do I CIEPS com a ponte ferroviária de Araguari"
              fill
              loading="eager"
            />
          </div>
        </div>
      </section>

      <section className="landing-origin" id="sobre">
        <div className="landing-origin-art">
          <Image
            src="/cieps/cieps-prefeitura-sketch-paper.png"
            width={2574}
            height={1632}
            alt="Ilustração arquitetônica da Prefeitura de Araguari"
          />
        </div>
        <div className="landing-origin-copy">
          <span className="cieps-kicker">Sobre o CIEPS</span>
          <h2 className="cieps-display">
            Um congresso que cresce sem perder o lugar de onde nasceu.
          </h2>
          <p>
            O I CIEPS preserva a história construída em Araguari e estreia sua
            1ª Edição Internacional com uma identidade mais forte, institucional e
            aberta ao futuro da saúde.
          </p>
        </div>
        <blockquote>
          “O internacional muda tudo.”
          <small>Minuta de direção</small>
        </blockquote>
      </section>

      <section className="landing-metrics" aria-label="Indicadores do congresso">
        {metrics.map(({ icon: Icon, value, label }) => (
          <article key={label}>
            <Icon className="landing-metric-icon" size={34} strokeWidth={1.75} />
            <div className="landing-metric-copy">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </article>
        ))}
        <article className="landing-metric-note">
          <Star className="landing-metric-icon" size={34} strokeWidth={1.75} />
          <div className="landing-metric-copy">
            <strong>Tradição</strong>
            <span>que inspira. Ciência que transforma.</span>
          </div>
        </article>
      </section>

      <section className="landing-programacao">
        <div className="landing-programacao-heading">
          <span className="cieps-kicker">Programação</span>
          <h2 className="cieps-display">
            Quatro dias para expandir conhecimento e conexões.
          </h2>
          <Link href="/programacao" prefetch={false}>
            Ver programação completa
          </Link>
        </div>

        <div className="landing-programacao-grid">
          {programacao.map(([date, title, detail]) => (
            <article key={date}>
              <strong>{date}</strong>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-feature-grid" id="araguari">
        <article className="landing-feature-copy">
          <span className="cieps-kicker">Araguari</span>
          <h2 className="cieps-display">
            Uma cidade que sustenta a escala do congresso.
          </h2>
          <p>
            Ferrovia, formação e encontro entre território e futuro orientam a
            linguagem do CIEPS. A marca não inventa grandeza; ela organiza a
            grandeza que já existe.
          </p>
        </article>

        <div className="landing-feature-media">
          <Image
            src="/cieps/cieps-notebook.png"
            width={1280}
            height={720}
            alt="Aplicação da identidade visual do CIEPS em caderno"
          />
        </div>
      </section>

      <section className="landing-science">
        <div className="landing-science-media">
          <Image
            src="/cieps/cieps-book.png"
            width={1280}
            height={720}
            alt="Livro com identidade visual do CIEPS"
          />
        </div>
        <article className="landing-science-copy">
          <span className="cieps-kicker">Trabalhos científicos</span>
          <h2 className="cieps-display">
            Compartilhe ciência. Transforme realidades.
          </h2>
          <p>
            Submeta seu trabalho e participe da produção científica que move o
            futuro da saúde.
          </p>
          <Link href="/trabalhos" prefetch={false} className="cieps-button-outline">
            Conhecer submissão
          </Link>
        </article>
      </section>

      <section className="landing-institutions" aria-label="Realização e apoio institucional">
        <article className="landing-institution-group">
          <span className="landing-institution-label">Realização</span>
          <div className="landing-logo-row">
            <div className="landing-logo-item landing-logo-dadg" aria-label="DADG">
              <Image
                src="/cieps/logo-dadg-symbol-mono.png"
                alt=""
                width={70}
                height={78}
                aria-hidden="true"
              />
              <strong>DADG</strong>
            </div>
          </div>
        </article>

        <article className="landing-institution-group landing-institution-support">
          <span className="landing-institution-label">Apoio</span>
          <div className="landing-logo-row landing-support-row">
            <div className="landing-logo-item landing-logo-imepac" aria-label="IMEPAC Araguari">
              <Image
                className="imepac-symbol"
                src="/cieps/logo-imepac-symbol-clean.png"
                width={96}
                height={96}
                alt=""
                aria-hidden="true"
              />
              <span className="imepac-wordmark">
                <strong>IMEPAC</strong>
                <small>ARAGUARI</small>
              </span>
            </div>

            <div
              className="landing-logo-item landing-logo-prefeitura"
              aria-label="Prefeitura de Araguari"
            >
              <Image
                className="prefeitura-symbol"
                src="/cieps/logo-prefeitura-symbol-clean.png"
                width={96}
                height={96}
                alt=""
                aria-hidden="true"
              />
              <span className="prefeitura-wordmark">
                <small>Prefeitura de</small>
                <strong>Araguari/MG</strong>
              </span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
