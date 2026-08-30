import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anais',
  description:
    'Anais do CIEPS organizados para consulta: trabalhos publicados nas edições do Congresso Internacional de Estudantes e Profissionais da Saúde.',
  alternates: { canonical: '/anais' },
  openGraph: {
    title: 'Anais | I CIEPS',
    description:
      'Anais do CIEPS organizados para consulta: trabalhos publicados nas edições do Congresso Internacional de Estudantes e Profissionais da Saúde.',
    url: '/anais',
    images: ['/cieps/og-cieps.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
