import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trabalhos científicos',
  description:
    'Submeta seu trabalho científico ao I CIEPS e participe da produção que move o futuro da saúde. Normas, prazos e categorias de submissão.',
  alternates: { canonical: '/trabalhos' },
  openGraph: {
    title: 'Trabalhos científicos | I CIEPS',
    description:
      'Submeta seu trabalho científico ao I CIEPS e participe da produção que move o futuro da saúde. Normas, prazos e categorias de submissão.',
    url: '/trabalhos',
    images: ['/cieps/og-cieps.png'],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
