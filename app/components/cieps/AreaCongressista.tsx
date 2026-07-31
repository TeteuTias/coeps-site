import Link from 'next/link';
import {
  Activity,
  BookOpen,
  Clock,
  CreditCard,
  QrCode,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react';
import { Card, Kicker, StatusBanner, cx } from './ui';

const quickActions = [
  { href: '/pagamentos', label: 'Meus pagamentos', icon: CreditCard },
  { href: '/painel/trabalhos/enviarTrabalho', label: 'Enviar trabalhos', icon: Upload },
  { href: '/painel/trabalhos', label: 'Consultar submissões', icon: BookOpen },
  { href: '/painel/minhaProgramacao', label: 'Minha programação', icon: Clock },
  { href: '/painel/minhasInformacoes', label: 'Minhas informações', icon: UserRound },
  { href: '/painel/comprovanteDeInscricao', label: 'Comprovante', icon: Sparkles },
  { href: '/painel/atividades', label: 'Atividades', icon: Activity },
];

const notices = [
  'Programação detalhada disponível em breve',
  'Prazo de submissão de trabalhos: acompanhe o edital',
  'Baixe seu crachá quando o check-in for liberado',
];

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-linha bg-white p-5">
      {accent && <span className="h-[3px] w-7 rounded-[2px] bg-ipe" />}
      <span className="font-title text-xl font-semibold text-goles">{value}</span>
      <span className="font-sans text-xs text-muted">{label}</span>
    </div>
  );
}

export default function AreaCongressista({
  nome = 'Congressista',
  userId,
  loadError,
}: {
  nome?: string;
  userId?: string | null;
  loadError?: string | null;
}) {
  return (
    <main className="flex min-h-screen flex-col gap-6 bg-papel p-6 md:p-10">
      <section className="rounded-lg border border-linha bg-white p-6 md:p-8">
        <Kicker>Área do congressista</Kicker>
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="font-title text-3xl font-semibold leading-tight text-tinta md:text-5xl">
              Olá, {nome}
            </h1>
            <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-muted md:text-base">
              Acompanhe sua inscrição, submissões, pagamentos, agenda e acesso ao I CIEPS em um
              painel direto.
            </p>
          </div>
          <Link
            href={`/qrCode/${userId ?? 'null'}`}
            prefetch={false}
            aria-disabled={!userId}
            className={cx(
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-goles px-5 py-3 font-sans text-sm font-semibold uppercase text-white transition-colors hover:bg-[#8f2323]',
              !userId && 'pointer-events-none opacity-55',
            )}
          >
            <QrCode size={18} />
            Ver QR Code
          </Link>
        </div>
      </section>

      {loadError && (
        <StatusBanner tone="warning" title="Algumas informações não foram carregadas">
          {loadError}
        </StatusBanner>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat value="Confirmada" label="Status da inscrição" accent />
        <Stat value="Acompanhe" label="Avisos e próximos passos" />
        <Stat value="2026" label="Edição internacional" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card kicker="Ações principais" title="O essencial da sua participação.">
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {quickActions.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                prefetch={false}
                className="flex min-h-[82px] items-center gap-3 rounded-md border border-linha bg-papel/70 p-4 font-sans text-sm font-semibold text-tinta transition-colors hover:border-araguari/40 hover:bg-araguari/10"
              >
                <Icon className="shrink-0 text-goles" size={22} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card kicker="Próximos avisos" title="Fique atento aos próximos passos.">
          <ul className="mt-2 flex flex-col gap-2">
            {notices.map((notice) => (
              <li key={notice} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-ipe" />
                <span>{notice}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </main>
  );
}
