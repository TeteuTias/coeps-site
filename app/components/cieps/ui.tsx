import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import React from 'react';

type ClassValue = string | false | null | undefined;

export const cx = (...classes: ClassValue[]) => classes.filter(Boolean).join(' ');

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'danger';

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cx('cieps-page-shell', className)}>
      {children}
    </main>
  );
}

export function SectionHeading({
  kicker,
  title,
  description,
  action,
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('cieps-section-heading', className)}>
      <div className="min-w-0">
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1 className="cieps-display mt-3 text-[clamp(2rem,5vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-tinta">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-3xl font-sans text-[0.98rem] leading-7 text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Logo({
  size = 42,
  withText = true,
  className,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <span
        className="relative block shrink-0 overflow-hidden rounded-full bg-papel"
        style={{ width: size, height: size }}
      >
        <Image src="/cieps/cieps-mark.png" alt="" fill sizes={`${size}px`} className="object-contain" />
      </span>
      {withText && <span className="font-title text-lg font-bold leading-none text-tinta">CIEPS</span>}
    </div>
  );
}

export function Stripe({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-[3px]', className)} aria-hidden="true">
      <span className="h-1 w-[22px] rounded-[2px] bg-goles" />
      <span className="h-1 w-[14px] rounded-[2px] bg-ipe" />
      <span className="h-1 w-[10px] rounded-[2px] bg-araguari" />
      <span className="h-1 w-[6px] rounded-[2px] bg-ipe" />
    </div>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-[0.72rem] font-bold uppercase tracking-[0.08em] text-goles">
        {children}
      </span>
      <Stripe />
    </div>
  );
}

export function buttonClassName({
  variant = 'solid',
  full,
  className,
}: {
  variant?: ButtonVariant;
  full?: boolean;
  className?: string;
}) {
  return cx(
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-md border px-5 py-3 font-sans text-sm font-bold transition-[background-color,border-color,color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-goles disabled:cursor-not-allowed disabled:opacity-55',
    variant === 'solid' && 'border-goles bg-goles text-white hover:bg-[#8f2323]',
    variant === 'outline' && 'border-araguari/60 bg-transparent text-araguari hover:bg-araguari/10',
    variant === 'ghost' && 'border-transparent bg-transparent text-tinta hover:bg-tinta/5',
    variant === 'danger' && 'border-goles bg-white text-goles hover:bg-goles/10',
    full && 'w-full',
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  full?: boolean;
  loading?: boolean;
};

export function Button({
  variant = 'solid',
  full,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, full, className })}
    >
      {loading && <Loader2 className="animate-spin" size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'solid',
  full,
  className,
  children,
  target,
  rel,
}: {
  href: string;
  variant?: ButtonVariant;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      target={target}
      rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
      className={buttonClassName({ variant, full, className })}
    >
      {children}
    </Link>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-ipe px-3 py-1.5 font-sans text-[0.72rem] font-bold text-tinta">
      {children}
    </span>
  );
}

const toneStyles: Record<StatusTone, string> = {
  neutral: 'border-linha bg-white text-tinta',
  info: 'border-araguari/35 bg-araguari/10 text-tinta',
  success: 'border-[#2f7651]/35 bg-[#2f7651]/10 text-tinta',
  warning: 'border-ipe/60 bg-ipe/10 text-tinta',
  error: 'border-goles/35 bg-goles/10 text-tinta',
};

const toneIcons = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

export function StatusBanner({
  tone = 'neutral',
  title,
  children,
  action,
  className,
}: {
  tone?: StatusTone;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  return (
    <section
      className={cx('flex items-start gap-3 rounded-lg border p-4 sm:p-5', toneStyles[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 shrink-0 text-goles" size={20} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong className="block font-sans text-sm font-bold">{title}</strong>
        {children && <div className="mt-1 font-sans text-sm leading-6 text-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}

export function AsyncStatePanel({
  status,
  loadingTitle = 'Carregando informações',
  emptyTitle = 'Nenhuma informação disponível',
  errorTitle = 'Não foi possível carregar',
  message,
  onRetry,
  className,
}: {
  status: 'loading' | 'empty' | 'error';
  loadingTitle?: string;
  emptyTitle?: string;
  errorTitle?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (status === 'loading') {
    return (
      <div className={cx('cieps-state-panel', className)} role="status" aria-live="polite">
        <Loader2 className="animate-spin text-goles" size={28} aria-hidden="true" />
        <strong>{loadingTitle}</strong>
        <span>Aguarde um instante.</span>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className={cx('cieps-state-panel', className)} role="status">
        <Info className="text-araguari" size={28} aria-hidden="true" />
        <strong>{emptyTitle}</strong>
        {message && <span>{message}</span>}
      </div>
    );
  }

  return (
    <div className={cx('cieps-state-panel', className)} role="alert">
      <AlertCircle className="text-goles" size={28} aria-hidden="true" />
      <strong>{errorTitle}</strong>
      <span>{message ?? 'Tente novamente. Se o problema continuar, entre em contato com a organização.'}</span>
      {onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function FormField({
  htmlFor,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  htmlFor: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('cieps-form-field', className)}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? <span className="cieps-field-error">{error}</span> : hint ? <span className="cieps-field-hint">{hint}</span> : null}
    </div>
  );
}

export function Card({
  kicker,
  title,
  children,
  action,
  className,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cx('flex flex-col gap-3 rounded-lg border border-linha bg-white p-7', className)}>
      <span className="font-sans text-[0.72rem] font-bold uppercase tracking-[0.08em] text-goles">{kicker}</span>
      <h2 className="font-title text-2xl font-semibold leading-snug text-tinta">{title}</h2>
      <div className="font-sans text-sm leading-relaxed text-muted">{children}</div>
      {action}
    </article>
  );
}

export function ImageBox({
  src,
  alt = '',
  className,
  imageClassName,
  label,
  priority,
}: {
  src?: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  label?: string;
  priority?: boolean;
}) {
  return (
    <div className={cx('relative flex items-center justify-center overflow-hidden bg-linha/60', className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 520px"
          priority={priority}
          className={cx('object-cover', imageClassName)}
        />
      ) : (
        label && <span className="font-sans text-xs font-medium text-muted">{label}</span>
      )}
    </div>
  );
}
