'use client';

import { useId, useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Button, Modal } from '@/components/cieps';
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout';
import { buildAuthLoginPath, sanitizeAuthReturnTo } from '@/lib/auth-migration-notice';

export default function PasswordMigrationNotice({ returnTo }: { returnTo: string }) {
  const acknowledgementId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const safeReturnTo = sanitizeAuthReturnTo(returnTo);

  const continueToLogin = async () => {
    if (!acknowledged || submitting) return;

    setSubmitting(true);

    try {
      await fetchWithTimeout(
        '/api/auth-migration-notice/acknowledge',
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
        },
        4_000,
      );
    } catch {
      // O aviso não pode impedir o acesso se o navegador recusar o cookie.
    } finally {
      window.location.replace(buildAuthLoginPath(safeReturnTo));
    }
  };

  return (
    <Modal
      open
      dismissible={false}
      className="auth-migration-notice-modal"
      title={<span className="auth-migration-notice-title">Atenção: sua senha antiga não vai funcionar</span>}
      description="Leia estas orientações antes de entrar na Área do congressista."
      footer={
        <Button
          type="button"
          full
          loading={submitting}
          disabled={!acknowledged}
          onClick={continueToLogin}
        >
          Continuar para o login
        </Button>
      }
    >
      <div className="auth-migration-notice-intro">
        <span className="auth-migration-notice-icon" aria-hidden="true">
          <ShieldAlert size={30} strokeWidth={1.9} />
        </span>
        <p>
          Recentemente migramos o sistema de acesso do CIEPS. Sua conta e seus dados continuam
          existindo, mas as senhas antigas não puderam ser transferidas. Por isso, se você já tinha
          uma conta, será necessário criar uma nova senha no primeiro acesso.
        </p>
      </div>

      <section className="auth-migration-notice-steps" aria-labelledby="password-migration-steps-title">
        <div className="auth-migration-notice-section-heading">
          <KeyRound size={22} aria-hidden="true" />
          <h3 id="password-migration-steps-title">Como recuperar seu acesso</h3>
        </div>
        <ol>
          <li>Clique em <strong>“Continuar para o login”</strong>.</li>
          <li>Informe o <strong>mesmo e-mail</strong> que você já utilizava no CIEPS.</li>
          <li>
            Na tela segura de login do Auth0, clique em <strong>“Redefinir senha”</strong>.
          </li>
          <li>
            Abra o e-mail enviado pelo Auth0 — verifique também <strong>Spam</strong> e
            <strong> Lixo eletrônico</strong> — e defina uma nova senha.
          </li>
          <li>Volte ao login e entre utilizando essa nova senha.</li>
        </ol>
      </section>

      <aside className="auth-migration-notice-warning">
        <strong>Não crie outra conta se você já possuía cadastro.</strong>
        <p>
          Use o mesmo e-mail para manter sua inscrição e seus dados existentes vinculados ao acesso.
        </p>
      </aside>

      <p className="auth-migration-notice-already-reset">
        Se você já redefiniu sua senha depois da migração, basta continuar e entrar normalmente.
      </p>

      <label className="auth-migration-notice-acknowledgement" htmlFor={acknowledgementId}>
        <input
          id={acknowledgementId}
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>
          Li e entendi que minha senha antiga foi invalidada e que devo usar o mesmo e-mail para
          redefini-la, caso ainda não tenha feito isso.
        </span>
      </label>
    </Modal>
  );
}
