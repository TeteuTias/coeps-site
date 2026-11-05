'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/cieps';

// Trocar a chave a cada novo aviso, para quem fechou o anterior ver o novo.
const STORAGE_KEY = 'cieps-aviso-comunicado-banners';

/**
 * Comunicado aos autores: orientações para os banners e cotações de impressão.
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
    <Modal open={open} onClose={close} title="Comunicado aos participantes do I CIEPS" className="aviso-autores-card">
      <Image
        src="/avisos/comunicado-banners.webp"
        width={1400}
        height={1978}
        alt="Comunicado aos participantes do I CIEPS, de 03 de outubro de 2026: orientações para confecção dos banners e cotações de impressão. Os banners devem ter 90 × 120 cm, com cordinha para pendurar e bastão superior; o material é livre desde que preserve a legibilidade. Cotações: Gráfica Pontual (Araguari), R$ 130,00, 3 a 5 dias, (34) 99976-5891; Artes Gráficas (Uberlândia), R$ 100,00, 1 dia, (34) 3255-9500; Amplion Comunicação Visual (Uberlândia), R$ 90,00, 2 dias, (34) 99323-5111; Word Design (Araguari), R$ 70,00, 3 a 5 dias, (34) 3241-2646."
        className="aviso-autores-imagem"
        priority
      />
    </Modal>
  );
}
