'use client'

import { useEffect } from 'react';

export default function TrackVisibilityChange ({toggleState}) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        toggleState(0)
      } else {
        toggleState(1)
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
