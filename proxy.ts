import { NextResponse } from 'next/server';
import { getAuth0Client, isAuth0Configured } from './app/lib/auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'bson';
import { IUser } from '@/lib/types/user/user.t';
import {
  AUTH_MIGRATION_GATE_COOKIE_NAME,
  buildAuthEntryPath,
  isAuthMigrationGateSatisfied,
} from '@/lib/auth-migration-notice';
import { getRegistrationRedirect } from '@/lib/registration-gate';

const protectedRoutes = [
  '/painel',
  '/pagamentos',
  '/qrCode',
];
function isProtectedRoute(pathname) {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}
export async function proxy(req) {
  const path = req.nextUrl.pathname;

  if (!isAuth0Configured) {
    if (path.startsWith('/auth') || isProtectedRoute(path)) {
      return NextResponse.json(
        {
          error: 'auth_configuration_error',
          message: 'O serviço de autenticação não está configurado.',
        },
        { status: 500 },
      );
    }
    return NextResponse.next();
  }

  const auth0 = getAuth0Client();

  // 1. Libera Rotas do Auth0 (NUNCA INTERROMPER)
  if (path.startsWith("/auth/")) { // Ou /api/auth/ se for o padrão do Next!
    return await auth0.middleware(req);
  }

  // 2. Libera Rotas da API Interna
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 3. Fazemos a classificação antes de consultar a sessão para manter
  // todas as rotas públicas livres de dependências de autenticação.
  if (!isProtectedRoute(path)) {
    return NextResponse.next();
  }

  // ============== DAQUI PARA BAIXO, SÓ ROTAS PROTEGIDAS ==============

  const session = await auth0.getSession(req);
  const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const gateCookie = req.cookies.get(AUTH_MIGRATION_GATE_COOKIE_NAME)?.value;
  const gateSatisfied = isAuthMigrationGateSatisfied(gateCookie);

  // 4. Se não tem sessão em rota protegida, força o login
  if (!session) {
    if (!gateSatisfied) {
      return NextResponse.redirect(new URL(buildAuthEntryPath(returnTo), req.nextUrl.origin));
    }
    return auth0.startInteractiveLogin({ returnTo });
  }

  if (!session.user?.sub) {
    if (!gateSatisfied) {
      return NextResponse.redirect(new URL(buildAuthEntryPath(returnTo), req.nextUrl.origin));
    }
    return auth0.startInteractiveLogin({ returnTo });
  }

  // 5. Usuário está logado. Vamos buscar os dados.
  // ATENÇÃO: Lembre-se do aviso sobre o MongoDB no Edge Runtime!
  const { db } = await connectToDatabase();
  const userId = session.user.sub.replace(/^auth0\|/, '');
  if (!ObjectId.isValid(userId)) {
    if (!gateSatisfied) {
      return NextResponse.redirect(new URL(buildAuthEntryPath(returnTo), req.nextUrl.origin));
    }
    return auth0.startInteractiveLogin({ returnTo });
  }
  const user: IUser | null = await db.collection("usuarios").findOne({ _id: new ObjectId(userId) });

  // 6. Pagamento vem antes do cadastro completo. A confirmação financeira
  // é a única condição que libera o formulário congressista e a LGPD.
  const redirect = getRegistrationRedirect({
    path,
    profileComplete: Boolean(user?.isPos_registration),
    paymentConfirmed: user?.pagamento?.situacao === 1,
    confirmationSeen: Boolean(user?.pagamento?.situacao_animacao),
  });
  if (redirect) {
    return NextResponse.redirect(new URL(redirect, req.nextUrl.origin));
  }

  // 9. Se sobreviveu a tudo, passa o middleware do Auth0
  return auth0.middleware(req);
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
