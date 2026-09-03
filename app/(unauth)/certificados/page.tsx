import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Certificados',
  description:
    'Como funciona a emissão de certificados do I CIEPS e onde o congressista deve solicitá-los.',
  alternates: { canonical: '/certificados' },
  openGraph: {
    title: 'Certificados | I CIEPS',
    description:
      'Como funciona a emissão de certificados do I CIEPS e onde o congressista deve solicitá-los.',
    url: '/certificados',
    images: ['/cieps/og-cieps.png'],
  },
};

import Link from 'next/link';
import { ArrowRight, FileCheck2 } from 'lucide-react';
import './style.css';

export default function CertificadosPublicos() {
  return (
    <main className="certificados-public-page">
      <section className="certificados-public-card cieps-surface">
        <span className="cieps-kicker">Certificados</span>
        <div className="certificados-public-icon">
          <FileCheck2 size={28} />
        </div>
        <h1 className="cieps-display">A emissão não será realizada pelo site.</h1>
        <p>
          O I CIEPS manterá nesta plataforma apenas as informações oficiais do
          congresso. A orientação de acesso aos certificados será comunicada
          separadamente pelos canais institucionais.
        </p>
        <Link href="/" className="cieps-button">
          Voltar ao início
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
