'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/cieps';

const STORAGE_KEY = 'cieps-aviso-autores-correcao';

/**
 * Aviso da semana de correção dos trabalhos (mesma arte publicada no Instagram).
 * Abre ao entrar na página inicial e, depois de fechado, não volta a abrir
 * na mesma sessão do navegador.
 */
export default function AvisoAutoresPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // sessionStorage indisponível: o aviso aparece normalmente.
    }
    setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Sem sessionStorage o aviso só reaparece ao recarregar a página.
    }
  };

  return (
    <Modal open={open} onClose={close} title="Atenção, autores" className="aviso-autores-card">
      <Image
        src="/avisos/aviso-autores-correcao.webp"
        width={720}
        height={1280}
        alt="Científica informa: estamos na semana de correção dos trabalhos científicos. Acompanhem o e-mail cadastrado e o site oficial do I CIEPS. O prazo para realizar os ajustes solicitados é de apenas 24 horas após a disponibilização da correção."
        className="aviso-autores-imagem"
        priority
      />
    </Modal>
  );
}
