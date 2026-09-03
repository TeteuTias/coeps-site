import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.congressocieps.com.br';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Áreas autenticadas, rotas de API e fluxos de pagamento não devem ser indexados.
        disallow: ['/api/', '/painel', '/pagamentos', '/qrCode', '/entrar', '/iniciar-cadastro'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
