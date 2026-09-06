type AuthorLimitsConfig = {
  autores_por_trabalho: number;
  maximo_orientadores: number;
};

export function getAcademicWorkAuthorLimits(config?: AuthorLimitsConfig) {
  if (!config || !Number.isInteger(config.autores_por_trabalho) ||
      config.autores_por_trabalho < 1 || !Number.isInteger(config.maximo_orientadores) ||
      config.maximo_orientadores < 1) {
    return null;
  }

  // Os limites de autores e orientadores são independentes no banco.
  return {
    total: config.autores_por_trabalho + config.maximo_orientadores,
    authors: config.autores_por_trabalho,
    advisors: config.maximo_orientadores,
  };
}

export function validateAcademicWorkAuthors(autores: unknown, config?: AuthorLimitsConfig): string | null {
  const limits = getAcademicWorkAuthorLimits(config);
  if (!limits) return 'Configuração de autores inválida. Entre em contato com o suporte.';
  if (!Array.isArray(autores) || autores.some(autor =>
    !autor || typeof autor !== 'object' || typeof autor.isOrientador !== 'boolean')) {
    return 'A lista de autores é inválida.';
  }

  const orientadores = autores.filter(autor => autor.isOrientador).length;
  if (limits.advisors === 1 && orientadores !== 1) return 'É necessário indicar exatamente 1 orientador.';
  if (orientadores === 0) return 'É necessário indicar pelo menos 1 orientador.';
  if (orientadores > limits.advisors) return `O número máximo de orientadores permitido é ${limits.advisors}.`;
  const authors = autores.length - orientadores;
  if (authors === 0) return 'É necessário informar pelo menos 1 autor além do orientador.';
  if (authors > limits.authors) {
    return `Esta modalidade permite até ${limits.authors} ${limits.authors === 1 ? 'autor' : 'autores'} + ${limits.advisors} ${limits.advisors === 1 ? 'orientador' : 'orientadores'} (total de ${limits.total} participantes).`;
  }
  return null;
}
