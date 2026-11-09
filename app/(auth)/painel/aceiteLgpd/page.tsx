'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, StatusBanner } from '@/app/components/cieps';
import LgpdText from '@/app/components/LgpdText';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';
import { LGPD_CONSENT_VERSION } from '@/lib/registration-consent';

// Só chega aqui (via proxy) quem tem cadastro completo e não tem o aceite da LGPD gravado.
export default function AceiteLgpd() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const aceitar = async () => {
    if (saving || !agreed) return;
    setSaving(true);
    setErro('');
    try {
      const response = await fetchWithTimeout('/api/post/aceiteLgpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lgpdAccepted: true, lgpdVersion: LGPD_CONSENT_VERSION }),
      });
      if (!response.ok) {
        const json = await readJsonResponse<{ message?: string }>(response);
        setErro(json?.message || 'Não foi possível registrar seu aceite. Tente novamente.');
        return;
      }
      router.push('/painel');
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error && error.message ? error.message : 'Não foi possível registrar seu aceite. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      dismissible={false}
      title="Atualizamos nossa Política de Privacidade (LGPD)"
      description="Para continuar usando a plataforma, leia a versão atual e confirme seu aceite."
      className="max-w-2xl"
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <a href="/auth/logout" className="inline-flex items-center justify-center rounded-md border border-linha px-4 py-2 text-sm font-bold text-tinta">Sair</a>
          <Button onClick={aceitar} loading={saving} disabled={!agreed}>Aceitar e continuar</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3 text-[0.95rem] text-[var(--cieps-ink)]">
        {erro ? <StatusBanner tone="warning" title="Não foi possível continuar">{erro}</StatusBanner> : null}
        <LgpdText />
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--cieps-line)] p-3 sm:p-4">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-goles"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span className="text-sm font-medium leading-snug">
            Li e concordo com o tratamento dos meus dados pessoais para as finalidades descritas acima, nos termos da Lei nº 13.709/2018 (LGPD).
          </span>
        </label>
      </div>
    </Modal>
  );
}
