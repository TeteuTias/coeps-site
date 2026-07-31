import { ButtonLink, PageShell, StatusBanner } from '@/components/cieps';

export default function PaginaErrorPadrao({
  title = 'Não foi possível abrir esta página',
  message = 'Tente novamente em alguns instantes. Se o problema continuar, entre em contato com a equipe do I CIEPS.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <PageShell className="flex items-center justify-center">
      <section className="w-full max-w-2xl rounded-lg border border-linha bg-white p-6 shadow-[var(--cieps-shadow)] sm:p-10">
        <span className="cieps-kicker">Algo deu errado</span>
        <h1 className="cieps-display mt-3 text-4xl font-semibold leading-tight text-tinta">{title}</h1>
        <StatusBanner tone="error" title="A informação não pôde ser carregada" className="mt-6">
          {message}
        </StatusBanner>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/painel">Voltar ao painel</ButtonLink>
          <ButtonLink href="/" variant="outline">Ir para o site</ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
