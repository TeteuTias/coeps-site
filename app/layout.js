import './globals.css';

export const metadata = {
  title: {
    default: 'I CIEPS',
    template: '%s | I CIEPS',
  },
  description: 'Site oficial da 1ª Edição Internacional do Congresso Internacional de Estudantes e Profissionais da Saúde.',
  icons: {
    icon: '/icon.png',
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
      <body>{children}</body>
    </html>
  );
}
