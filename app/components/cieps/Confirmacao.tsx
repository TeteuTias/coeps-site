'use client';

import Image from 'next/image';
import { Button, StatusBanner } from './ui';

export default function Confirmacao({
  onContinue,
  isLoading = false,
  error,
}: {
  onContinue: () => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-papel px-4 py-12">
      <section className="flex w-full max-w-[560px] flex-col items-center gap-4 rounded-2xl border border-linha bg-white p-8 text-center md:p-12">
        <div className="relative h-14 w-14 overflow-hidden rounded-full bg-papel">
          <Image src="/cieps/cieps-mark.png" alt="" fill sizes="56px" className="object-contain" />
        </div>
        <h1 className="font-title text-2xl font-semibold text-tinta">Inscrição confirmada!</h1>
        <p className="font-sans text-sm text-muted">
          Sua vaga no I CIEPS está reservada. Os detalhes ficam disponíveis no seu painel.
        </p>

        <div className="flex w-full overflow-hidden rounded-lg border border-linha text-left">
          <span className="w-1 shrink-0 bg-ipe" />
          <div className="flex flex-col gap-1.5 p-[18px]">
            <span className="font-sans text-[11px] font-semibold uppercase text-goles">
              Resumo
            </span>
            <span className="font-sans text-[13px] font-medium text-tinta">
              Inscrição confirmada
            </span>
            <span className="font-sans text-[13px] text-muted">
              Comprovante e programação ficam disponíveis no painel do congressista.
            </span>
          </div>
        </div>

        {error && (
          <StatusBanner tone="error" title="Não foi possível abrir o painel" className="w-full text-left">
            {error}
          </StatusBanner>
        )}

        <Button full onClick={onContinue} loading={isLoading}>
          {isLoading ? 'Abrindo painel...' : 'Ir para meu painel'}
        </Button>
      </section>
    </main>
  );
}
