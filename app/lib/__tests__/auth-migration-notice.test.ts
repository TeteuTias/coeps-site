import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_MIGRATION_GATE_COOKIE_VALUE,
  buildAuthEntryPath,
  buildAuthLoginPath,
  buildSignupEntryPath,
  isAuthMigrationGateSatisfied,
  sanitizeAuthReturnTo,
} from '../auth-migration-notice.ts';

test('sanitizeAuthReturnTo preserves supported authenticated destinations', () => {
  assert.equal(sanitizeAuthReturnTo('/painel'), '/painel');
  assert.equal(
    sanitizeAuthReturnTo('/painel/trabalhos?aba=pendentes#envio'),
    '/painel/trabalhos?aba=pendentes#envio',
  );
  assert.equal(sanitizeAuthReturnTo('/pagamentos?origem=painel'), '/pagamentos?origem=painel');
  assert.equal(sanitizeAuthReturnTo('/qrCode/123'), '/qrCode/123');
  assert.equal(sanitizeAuthReturnTo(['/painel/certificados', '/pagamentos']), '/painel/certificados');
});

test('sanitizeAuthReturnTo rejects external, malformed and public destinations', () => {
  const rejectedValues = [
    undefined,
    null,
    '',
    'https://evil.example/painel',
    '//evil.example/painel',
    '/\\evil.example/painel',
    '/painel\\redirect',
    '/painel-falso',
    '/programacao',
    '/painel\u0000',
  ];

  for (const value of rejectedValues) {
    assert.equal(sanitizeAuthReturnTo(value), '/painel');
  }
});

test('auth entry builders preserve the safe destination and signup intent', () => {
  assert.equal(
    buildAuthEntryPath('/painel/trabalhos?aba=pendentes'),
    '/entrar?returnTo=%2Fpainel%2Ftrabalhos%3Faba%3Dpendentes',
  );
  assert.equal(
    buildAuthLoginPath('/painel/trabalhos?aba=pendentes'),
    '/auth/login?returnTo=%2Fpainel%2Ftrabalhos%3Faba%3Dpendentes',
  );
  assert.equal(
    buildAuthLoginPath('/painel', true),
    '/auth/login?returnTo=%2Fpainel&screen_hint=signup',
  );
  assert.equal(
    buildSignupEntryPath('/painel'),
    '/iniciar-cadastro?returnTo=%2Fpainel',
  );
});

test('only the current cookie version satisfies the migration gate', () => {
  assert.equal(isAuthMigrationGateSatisfied(AUTH_MIGRATION_GATE_COOKIE_VALUE), true);
  assert.equal(isAuthMigrationGateSatisfied('v0'), false);
  assert.equal(isAuthMigrationGateSatisfied(''), false);
  assert.equal(isAuthMigrationGateSatisfied(undefined), false);
});
