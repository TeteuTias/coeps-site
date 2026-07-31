import { ButtonLink, PageShell, StatusBanner } from '@/components/cieps';

export default function NotFound() {
  return (
    <PageShell className="flex items-center justify-center">
      <section className="w-full max-w-2xl rounded-lg border border-linha bg-white p-6 shadow-[var(--cieps-shadow)] sm:p-10">
        <span className="cieps-kicker">Página não encontrada</span>
        <h1 className="cieps-display mt-3 text-5xl font-semibold text-tinta">Este endereço não existe.</h1>
        <StatusBanner tone="info" title="Confira o link" className="mt-6">
          O conteúdo pode ter mudado de endereço ou ainda não estar disponível.
        </StatusBanner>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/">Ir para o início</ButtonLink>
          <ButtonLink href="/painel" variant="outline">Área do congressista</ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
