import { NextResponse } from 'next/server';
import { getAuth0Client, isAuth0Configured } from './app/lib/auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'bson';
import { IUser } from '@/lib/types/user/user.t';

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
  const isPagamentos = path.startsWith("/pagamentos");

  if (!isProtectedRoute(path)) {
    return NextResponse.next();
  }

  // ============== DAQUI PARA BAIXO, SÓ ROTAS PROTEGIDAS ==============

  const session = await auth0.getSession(req);

  // 4. Se não tem sessão em rota protegida, força o login
  if (!session) {
    const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return auth0.startInteractiveLogin({ returnTo });
  }

  if (!session.user?.sub) {
    const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return auth0.startInteractiveLogin({ returnTo });
  }

  // 5. Usuário está logado. Vamos buscar os dados.
  // ATENÇÃO: Lembre-se do aviso sobre o MongoDB no Edge Runtime!
  const { db } = await connectToDatabase();
  const userId = session.user.sub.replace(/^auth0\|/, '');
  if (!ObjectId.isValid(userId)) {
    const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return auth0.startInteractiveLogin({ returnTo });
  }
  const user: IUser | null = await db.collection("usuarios").findOne({ _id: new ObjectId(userId) });

  // 6. Verificação de Perfil Incompleto

  if (!user || !user.isPos_registration) {
    if (path === "/painel/dadosIniciais") { // Usar === evita falsos positivos
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/painel/dadosIniciais", req.nextUrl.origin));
  }

  // 7. Verificação de Pagamento Pendente
  const pago = user.pagamento?.situacao === 1;
  const isCertificados = path.startsWith("/painel/certificados");

  if (!pago && !isCertificados && !isPagamentos) {
    return NextResponse.redirect(new URL("/pagamentos", req.nextUrl.origin));
  }

  // 8. Lógica da Animação de Confirmação de Inscrição
  const isAnimacaoPage = path.startsWith("/painel/suaInscricaoFoiConfirmada");

  // Regra A: Se ele PAGOU, NÃO VIU a animação, e NÃO ESTÁ na página -> manda pra lá
  if (pago && !user.pagamento?.situacao_animacao && !isAnimacaoPage) {
    return NextResponse.redirect(new URL("/painel/suaInscricaoFoiConfirmada", req.nextUrl.origin));
  }

  // Regra B: Se ele JÁ VIU a animação, e TENTAR ENTRAR na página -> bloqueia e manda pro painel
  if (user.pagamento?.situacao_animacao && isAnimacaoPage) {
    return NextResponse.redirect(new URL("/painel", req.nextUrl.origin));
  }

  // 9. Se sobreviveu a tudo, passa o middleware do Auth0
  return auth0.middleware(req);
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
