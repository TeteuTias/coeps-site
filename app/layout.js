import Script from 'next/script';
import './globals.css';

const SITE_URL = 'https://www.congressocieps.com.br';
const SITE_NAME = 'I CIEPS';
const SITE_TITLE = 'I CIEPS — Congresso Internacional de Estudantes e Profissionais da Saúde';
const SITE_DESCRIPTION =
  'Site oficial da 1ª Edição Internacional do Congresso Internacional de Estudantes e Profissionais da Saúde. Araguari, Minas Gerais, de 12 a 15 de novembro de 2026.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | I CIEPS',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'CIEPS',
    'COEPS',
    'congresso de saúde',
    'congresso estudantil',
    'Araguari',
    'IMEPAC',
    'DADG',
    'trabalhos científicos',
    'minicursos',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/cieps/og-cieps.png',
        width: 1200,
        height: 630,
        alt: 'I CIEPS — Congresso Internacional de Estudantes e Profissionais da Saúde',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/cieps/og-cieps.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f1ea',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Meta Pixel Code */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '2392093421199963');
              fbq('track', 'PageView');
            `,
          }}
        />
        {/* End Meta Pixel Code */}
      </head>
      <body>{children}</body>
    </html>
  );
}
