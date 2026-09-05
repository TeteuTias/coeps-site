export interface AcademicWorksPublication {
  link: string;
  titulo: string;
}

interface PublicAcademicWorksConfig {
  link_edital?: string;
  resultados?: readonly AcademicWorksPublication[];
}

function normalizeTitle(title: string) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isPreviousCoepsEdital(publication: AcademicWorksPublication) {
  const title = normalizeTitle(publication.titulo);
  return title.includes('edital') && title.includes('coeps') && /\b2025\b/.test(title);
}

function isCurrentCiepsEdital(publication: AcademicWorksPublication) {
  const title = normalizeTitle(publication.titulo);
  return title.includes('edital') && /\bi cieps\b/.test(title);
}

export function getPublicAcademicWorks(config?: PublicAcademicWorksConfig | null) {
  const publications = config?.resultados ?? [];
  const previousEditalLinks = new Set(
    publications.filter(isPreviousCoepsEdital).map((publication) => publication.link),
  );
  const visiblePublications = publications.filter(
    (publication) => !isPreviousCoepsEdital(publication),
  );
  const currentCiepsEdital = visiblePublications.find(isCurrentCiepsEdital)?.link;
  const configuredEdital = config?.link_edital?.trim();

  return {
    publications: visiblePublications,
    editalLink:
      configuredEdital && !previousEditalLinks.has(configuredEdital)
        ? configuredEdital
        : currentCiepsEdital,
  };
}
