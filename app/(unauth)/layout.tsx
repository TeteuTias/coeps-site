import Header from '@/app/components/Header';
import Image from 'next/image';
import Link from 'next/link';
import { buildAuthEntryPath } from '@/lib/auth-migration-notice';
import './style.home.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="cieps-footer" id="contato">
      <div className="cieps-footer-grid">
        <div className="cieps-footer-brand">
          <Image
            src="/cieps/cieps-lockup-horizontal.png"
            width={420}
            height={136}
            alt="Marca do I CIEPS"
          />
          <p>
            I CIEPS. A 1ª Edição Internacional do Congresso Internacional de
            Estudantes e Profissionais da Saúde.
          </p>
        </div>

        <div className="cieps-footer-column">
          <h2>Contato</h2>
          <a href="mailto:dadg.imepac@gmail.com">dadg.imepac@gmail.com</a>
          <a
            href="https://api.whatsapp.com/send?phone=5562983306426"
            target="_blank"
            rel="noopener noreferrer"
          >
            +55 34 99120-9359
          </a>
          <a
            href="https://www.instagram.com/coeps.araguari/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram oficial
          </a>
        </div>

        <div className="cieps-footer-column">
          <h2>Acessos rápidos</h2>
          <Link href="/programacao" prefetch={false}>Programação</Link>
          <Link href="/trabalhos" prefetch={false}>Trabalhos científicos</Link>
          <Link href="/anais" prefetch={false}>Anais</Link>
          <Link href={buildAuthEntryPath('/painel')} prefetch={false}>Área do congressista</Link>
        </div>

        <div className="cieps-footer-column cieps-footer-meta">
          <h2>Institucional</h2>
          <p>Realização: DADG e IMEPAC Araguari</p>
          <p>Apoio: Prefeitura de Araguari</p>
          <p>Araguari, Minas Gerais, Brasil</p>
        </div>
      </div>
      <div className="cieps-footer-bottom">
        <span>© 2026 I CIEPS.</span>
        <span>1ª Edição Internacional.</span>
      </div>
    </footer>
  );
}
