import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inscrições',
  description:
    'Garanta sua vaga no I CIEPS. Lotes, valores e formas de pagamento da 1ª Edição Internacional do congresso, em Araguari.',
  alternates: { canonical: '/inscricoes' },
  openGraph: {
    title: 'Inscrições | I CIEPS',
    description:
      'Garanta sua vaga no I CIEPS. Lotes, valores e formas de pagamento da 1ª Edição Internacional do congresso, em Araguari.',
    url: '/inscricoes',
    images: ['/cieps/og-cieps.png'],
  },
};

import { Inscricoes } from '@/components/cieps';

export default function Page() {
  return <Inscricoes heroImage="/cieps/cieps-badge.png" />;
}
