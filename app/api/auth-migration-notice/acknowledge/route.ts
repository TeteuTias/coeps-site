import { NextResponse } from 'next/server';
import { setAuthMigrationGateCookie } from '@/lib/auth-migration-notice.server';

export async function POST() {
  const response = new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  });

  return setAuthMigrationGateCookie(response);
}
