import { AsyncStatePanel, PageShell } from '@/components/cieps';

export default function TelaLoading({ label = 'Carregando informações' }: { label?: string }) {
  return (
    <PageShell className="flex items-center justify-center">
      <AsyncStatePanel status="loading" loadingTitle={label} className="w-full max-w-2xl" />
    </PageShell>
  );
}
