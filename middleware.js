import { NextResponse } from 'next/server';
import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';
import { checkAndRefreshToken, checkAll, checkRoutes } from './app/utils/authUtils';
//
//
//
import { getSession } from '@auth0/nextjs-auth0/edge';
//
//

export const middleware = withMiddlewareAuthRequired(async (req) => {
  //const res = new NextResponse();
  const res = NextResponse.next()
  // Verificando Token.
  var check = await checkAndRefreshToken(req, res); // apesar do nome, ele não dá refresh.
  if (check) { return NextResponse.rewrite(check) }

  
  // Verificando pagamento
  if (!req.nextUrl.pathname.startsWith('/pagamentos')) {
    check = await checkAll(req, res)
    if (check) { return NextResponse.rewrite(check) }
  }

  check = await checkRoutes(req, res)
  if (check) { return NextResponse.rewrite(check) }

  return res
  //return NextResponse.next();
});
//
//

//
//
//
export const config = {
  matcher: [
    '/painel/:path*',
    '/updateData/:path*',
    '/pagamentos/:path*',
  ]
}
/*
      .Escrever na session.
  const res = new NextResponse();
  const session = await getSession(req, res)
  console.log(session)


  session.user.customProperty = 'valor personalizado';
  console.log(session)



  // converter session.acessTokenExpiresAt
  new Date ( 1721265770 *1000 )
*/
/* Lógica para alterar o acess token segundo o gemini - nao testei
 
    import { NextResponse } from 'next/server';
    import { getSession } from '@auth0/nextjs-auth0';

    export const middleware = async (req: NextRequest) => {
      const res = NextResponse.next();

      // Get the session from the request
      const session = await getSession(req, res);

      // Check if the user is logged in
      if (session?.isLoggedIn) {
        // Check if the access token is about to expire
        const accessTokenExpiresAt = session.accessTokenExpiresAt;
        const now = Date.now();
        if (accessTokenExpiresAt && now + 60000 > accessTokenExpiresAt) {
          // Refresh the access token
          const newAccessToken = await refreshAccessToken(session.refreshToken);

          // Update the session with the new access token
          session.accessToken = newAccessToken;
          session.accessTokenExpiresAt = Date.now() + session.accessTokenExpiresIn * 1000;

          // Update the authorization header in the response
          res.cookies.set('auth', JSON.stringify(session));
        }
      }

      // Continue with the middleware
      return res;
    };

    // Replace this with your actual refresh token function
    async function refreshAccessToken(refreshToken: string) {
      // Implement your logic to refresh the access token using the refresh token
      // and return the new access token
}

*/