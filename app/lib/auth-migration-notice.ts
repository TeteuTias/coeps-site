export const AUTH_MIGRATION_GATE_COOKIE_NAME = 'coeps_auth_migration_gate';
export const AUTH_MIGRATION_GATE_COOKIE_VALUE = 'v1';
export const AUTH_MIGRATION_GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_AUTH_RETURN_TO = '/painel';

const AUTHENTICATED_ROUTE_PREFIXES = ['/painel', '/pagamentos', '/qrCode'] as const;

type ReturnToValue = string | string[] | null | undefined;

function firstValue(value: ReturnToValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function sanitizeAuthReturnTo(value: ReturnToValue): string {
  const candidate = firstValue(value);

  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return DEFAULT_AUTH_RETURN_TO;
  }

  try {
    const parsed = new URL(candidate, 'https://coeps.local');
    const isAuthenticatedRoute = AUTHENTICATED_ROUTE_PREFIXES.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    );

    if (parsed.origin !== 'https://coeps.local' || !isAuthenticatedRoute) {
      return DEFAULT_AUTH_RETURN_TO;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_TO;
  }
}

export function isAuthMigrationGateSatisfied(value: string | null | undefined) {
  return value === AUTH_MIGRATION_GATE_COOKIE_VALUE;
}

export function buildAuthLoginPath(value: ReturnToValue, signup = false) {
  const searchParams = new URLSearchParams({
    returnTo: sanitizeAuthReturnTo(value),
  });

  if (signup) {
    searchParams.set('screen_hint', 'signup');
  }

  return `/auth/login?${searchParams.toString()}`;
}

export function buildAuthEntryPath(value: ReturnToValue) {
  const searchParams = new URLSearchParams({
    returnTo: sanitizeAuthReturnTo(value),
  });

  return `/entrar?${searchParams.toString()}`;
}

export function buildSignupEntryPath(value: ReturnToValue = DEFAULT_AUTH_RETURN_TO) {
  const searchParams = new URLSearchParams({
    returnTo: sanitizeAuthReturnTo(value),
  });

  return `/iniciar-cadastro?${searchParams.toString()}`;
}
