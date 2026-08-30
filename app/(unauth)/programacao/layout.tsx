import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Programação',
  description:
    'Confira a programação completa do I CIEPS: palestra magna, mesas-redondas, comunicações orais, minicursos e vivências, de 12 a 15 de novembro de 2026 em Araguari.',
  alternates: { canonical: '/programacao' },
  openGraph: {
    title: 'Programação | I CIEPS',
    description:
      'Confira a programação completa do I CIEPS: palestra magna, mesas-redondas, comunicações orais, minicursos e vivências, de 12 a 15 de novembro de 2026 em Araguari.',
    url: '/programacao',
    images: ['/cieps/og-cieps.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
