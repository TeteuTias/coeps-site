import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PasswordMigrationNotice from '@/components/PasswordMigrationNotice';
import { StatusBanner } from '@/components/cieps';
import {
  AUTH_MIGRATION_GATE_COOKIE_NAME,
  buildAuthLoginPath,
  isAuthMigrationGateSatisfied,
  sanitizeAuthReturnTo,
} from '@/lib/auth-migration-notice';
import { getAuth0Client, isAuth0Configured } from '@/lib/auth0';

type EntryPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function EntryPage({ searchParams }: EntryPageProps) {
  const params = await searchParams;
  const returnTo = sanitizeAuthReturnTo(params.returnTo);

  if (!isAuth0Configured) {
    return (
      <main className="auth-migration-entry-page">
        <StatusBanner tone="error" title="O acesso está temporariamente indisponível">
          O serviço de autenticação não está configurado. Tente novamente mais tarde.
        </StatusBanner>
      </main>
    );
  }

  const session = await getAuth0Client().getSession();
  if (session?.user?.sub) redirect(returnTo);

  const cookieStore = await cookies();
  const gateCookie = cookieStore.get(AUTH_MIGRATION_GATE_COOKIE_NAME)?.value;
  if (isAuthMigrationGateSatisfied(gateCookie)) {
    redirect(buildAuthLoginPath(returnTo));
  }

  return (
    <main className="auth-migration-entry-page">
      <p aria-hidden="true">Preparando seu acesso seguro…</p>
      <PasswordMigrationNotice returnTo={returnTo} />
    </main>
  );
}
