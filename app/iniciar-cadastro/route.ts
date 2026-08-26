import { NextRequest, NextResponse } from 'next/server';
import { buildAuthLoginPath, sanitizeAuthReturnTo } from '@/lib/auth-migration-notice';
import { setAuthMigrationGateCookie } from '@/lib/auth-migration-notice.server';

export function GET(request: NextRequest) {
  const returnTo = sanitizeAuthReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const loginUrl = new URL(buildAuthLoginPath(returnTo, true), request.nextUrl.origin);
  const response = NextResponse.redirect(loginUrl);

  return setAuthMigrationGateCookie(response);
}
