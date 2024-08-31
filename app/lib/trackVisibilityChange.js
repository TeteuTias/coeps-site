'use client'

import { useEffect } from 'react';

export default function TrackVisibilityChange ({toggleState}) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        toggleState(0)
        // Aqui você pode realizar alguma ação, como salvar o estado ou pausar uma funcionalidade
      } else {
        toggleState(1)
        // Aqui você pode realizar alguma ação quando o usuário volta, como retomar uma funcionalidade
      }
    };

    // Adiciona o listener para o evento de visibilidade
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup do listener ao desmontar o componente
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return;
}
