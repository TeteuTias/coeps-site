'use client';

import { useEffect } from 'react';
import { Button, ButtonLink, PageShell, StatusBanner } from '@/components/cieps';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Erro de interface não tratado:', error);
  }, [error]);

  return (
    <PageShell className="flex items-center justify-center">
      <section className="w-full max-w-2xl rounded-lg border border-linha bg-white p-6 shadow-[var(--cieps-shadow)] sm:p-10">
        <span className="cieps-kicker">Não foi possível concluir</span>
        <h1 className="cieps-display mt-3 text-4xl font-semibold text-tinta">A página encontrou um problema.</h1>
        <StatusBanner tone="error" title="Nenhum dado foi alterado" className="mt-6">
          Tente carregar novamente. Se o problema continuar, procure a organização do I CIEPS.
        </StatusBanner>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Tentar novamente</Button>
          <ButtonLink href="/" variant="outline">Ir para o início</ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
