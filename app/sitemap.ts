import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.congressocieps.com.br';

/** Páginas públicas indexáveis. A área do congressista fica fora por exigir login. */
const routes: Array<{ path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/inscricoes', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/programacao', priority: 0.9, changeFrequency: 'daily' },
  { path: '/trabalhos', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/anais', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/organizadores', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/certificados', priority: 0.4, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
