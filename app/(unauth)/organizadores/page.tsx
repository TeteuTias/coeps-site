import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Organizadores',
  description:
    'Conheça a equipe que organiza o I CIEPS: comissão organizadora, comissão científica e apoio institucional.',
  alternates: { canonical: '/organizadores' },
  openGraph: {
    title: 'Organizadores | I CIEPS',
    description:
      'Conheça a equipe que organiza o I CIEPS: comissão organizadora, comissão científica e apoio institucional.',
    url: '/organizadores',
    images: ['/cieps/og-cieps.png'],
  },
};

import Image from 'next/image';
import { BriefcaseBusiness, Compass, UsersRound } from 'lucide-react';
import './style.css';

const organizerCards = [
  {
    icon: <BriefcaseBusiness size={20} />,
    title: 'Direção',
    description: 'Responsável pela condução institucional e pelos marcos do congresso.',
  },
  {
    icon: <Compass size={20} />,
    title: 'Coordenações',
    description: 'Frentes que articulam experiência, programação e relacionamento.',
  },
  {
    icon: <UsersRound size={20} />,
    title: 'Equipe de apoio',
    description: 'Pessoas que sustentam a operação e acolhem o público durante o evento.',
  },
];

export default function Organizadores() {
  return (
    <main className="organizadores-page">
      <section className="organizadores-hero">
        <div>
          <span className="cieps-kicker">Organização</span>
          <h1 className="cieps-display">A equipe do I CIEPS ganha uma apresentação à altura.</h1>
          <p>
            Estamos preparando esta seção para publicar a composição oficial do congresso
            com a mesma clareza da nova identidade. O encontro já tem uma assinatura definida:
            I CIEPS, 1ª Edição Internacional.
          </p>
        </div>
        <Image
          src="/cieps/cieps-shirt-chair.png"
          width={520}
          height={420}
          alt="Aplicação da identidade visual do CIEPS em camiseta e mobiliário"
        />
      </section>

      <section className="organizadores-grid">
        {organizerCards.map((card) => (
          <article key={card.title} className="cieps-surface organizadores-card">
            <span>{card.icon}</span>
            <h2 className="cieps-display">{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="organizadores-note cieps-surface">
        <span className="cieps-kicker">Em breve</span>
        <h2 className="cieps-display">Nomes, frentes e responsabilidades serão publicados aqui.</h2>
        <p>
          A página já está pronta para receber a equipe definitiva, sem precisar
          de outra virada visual.
        </p>
      </section>
    </main>
  );
}
