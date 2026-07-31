'use client'

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const menuItems = [
  { name: 'Sobre', href: '/#sobre' },
  { name: 'Programação', href: '/programacao' },
  { name: 'Trabalhos', href: '/trabalhos' },
  { name: 'Informações', href: '/anais' },
  { name: 'Araguari', href: '/#araguari' },
  { name: 'Contato', href: '/#contato' },
  {
    name: "Login", href: "/painel/"
  },
];

export default function Header() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!menuAberto) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAberto(false);
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuAberto]);

  const itemIsActive = (href: string) => {
    if (!href.includes("#")) {
      return;
    }
    const route = href.split('#')[0] || '/';
    if (route === '/') return pathname === '/' && !href.includes('#');
    return pathname === route || pathname.startsWith(`${route}/`);
  };

  return (
    <header className={`cieps-header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="cieps-header-inner">
        <Link href="/" prefetch={false} className="cieps-brand">
          <Image
            src="/cieps/cieps-lockup-horizontal.png"
            alt="I CIEPS"
            width={420}
            height={136}
            priority
          />
        </Link>

        <nav className="cieps-nav" aria-label="Navegação principal">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              prefetch={false}
              aria-current={itemIsActive(item.href) ? 'page' : undefined}
              className={`${item.name.toLocaleLowerCase() === "painel" && "underline underline-offset-1 decoration-red-700 font-extrabold"}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className='cieps-header-cta'>
          <Link href="/inscricoes" prefetch={true} className="cieps-header-cta">
            Inscrições
          </Link>
        </div>

        <button
          type="button"
          className="cieps-menu-button"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
          aria-controls="cieps-mobile-navigation"
          onClick={() => setMenuAberto((value) => !value)}
        >
          {menuAberto ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuAberto && (
        <nav id="cieps-mobile-navigation" className="cieps-mobile-menu" aria-label="Navegação móvel">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              prefetch={false}
              aria-current={itemIsActive(item.href) ? 'page' : undefined}
              onClick={() => setMenuAberto(false)}
            >
              {item.name}
            </Link>
          ))}
          <Link
            href="/inscricoes"
            prefetch={false}
            className="cieps-mobile-cta"
            onClick={() => setMenuAberto(false)}
          >
            Fazer inscrição
          </Link>
        </nav>
      )}
    </header>
  );
}
