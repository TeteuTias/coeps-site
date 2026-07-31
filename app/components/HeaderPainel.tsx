'use client'

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, CreditCard, FileText, Home, LogOut, Menu, User, X } from 'lucide-react';

const menuItems = [
  { name: 'Início', href: '/', icon: <Home size={16} /> },
  { name: 'Meu painel', href: '/painel', icon: <User size={16} /> },
  { name: 'Trabalhos', href: '/painel/trabalhos', icon: <FileText size={16} /> },
  { name: 'Programação', href: '/painel/minhaProgramacao', icon: <Calendar size={16} /> },
  { name: 'Pagamentos', href: '/pagamentos', icon: <CreditCard size={16} /> },
];

export default function HeaderPainel({ isPayed = true }: { isPayed: boolean }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const itemIsActive = (href: string) => {
    if (href === '/' || href === '/painel') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
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

  return (
    <header className={`cieps-panel-header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="cieps-panel-header-inner">
        <Link href="/" prefetch={false} className="cieps-panel-brand">
          <Image
            className="cieps-panel-brand-lockup"
            src="/cieps/cieps-lockup-horizontal.png"
            width={420}
            height={136}
            alt="I CIEPS"
          />
          <Image
            className="cieps-panel-brand-mark"
            src="/cieps/cieps-mark.png"
            width={64}
            height={64}
            alt="I CIEPS"
          />
        </Link>

        <nav className="cieps-panel-nav" aria-label="Navegação do congressista">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              prefetch={false}
              className={itemIsActive(item.href) ? 'is-active' : undefined}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="cieps-panel-actions">
          {!isPayed && <span className="cieps-panel-alert">Pagamento pendente</span>}
          <a href="/auth/logout" className="cieps-panel-logout flex flex-row items-center">
            <span>Sair</span>
            <LogOut size={16} />
          </a>
        </div>

        <button
          type="button"
          className="cieps-panel-menu"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
          aria-controls="cieps-panel-mobile-navigation"
          onClick={() => setMenuAberto((value) => !value)}
        >
          {menuAberto ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuAberto && (
        <nav id="cieps-panel-mobile-navigation" className="cieps-panel-mobile" aria-label="Navegação móvel do congressista">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              prefetch={false}
              className={itemIsActive(item.href) ? 'is-active' : undefined}
              onClick={() => setMenuAberto(false)}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
          <a href="/auth/logout" onClick={() => setMenuAberto(false)}>
            <LogOut size={16} />
            <span>Sair</span>
          </a>
        </nav>
      )}
    </header>
  );
}
