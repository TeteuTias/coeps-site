import { NextResponse } from 'next/server';
import {
  AUTH_MIGRATION_GATE_COOKIE_MAX_AGE,
  AUTH_MIGRATION_GATE_COOKIE_NAME,
  AUTH_MIGRATION_GATE_COOKIE_VALUE,
} from './auth-migration-notice';

export function setAuthMigrationGateCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_MIGRATION_GATE_COOKIE_NAME,
    value: AUTH_MIGRATION_GATE_COOKIE_VALUE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_MIGRATION_GATE_COOKIE_MAX_AGE,
  });

  return response;
}
