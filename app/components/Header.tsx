'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronDown } from 'lucide-react';

const Header = () => {
  const [menuAberto, setMenuAberto] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const toggleMenu = () => {
    setMenuAberto(!menuAberto);
  };

  const toggleDropdown = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { name: 'Início', href: '/' },
    { name: 'Programação', href: '/programacao' },
    { name: 'Trabalhos', href: '/trabalhos' },
    { name: 'Inscrições', href: '/inscricoes' },
    { name: 'Organizadores', href: '/organizadores' },
    { name: 'Anais', href: '/anais' },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled 
        ? 'bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
        <div className="flex-shrink-0">
            <Link href="/" prefetch={false} className="flex items-center group">
              <div className="relative overflow-hidden rounded-xl transition-all duration-300 group-hover:scale-105">
            <Image
              src="/Logo01.png"
                  width={isScrolled ? 50 : 120}
                  height={isScrolled ? 50 : 120}
                  alt="COEPS Logo"
              className="transition-all duration-300"
            />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              </div>
          </Link>
        </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                prefetch={false}
                className="relative px-4 py-2 text-sm font-medium text-gray-800 hover:text-[#541A2C] transition-all duration-300 group"
              >
                <span className="relative z-10">{item.name}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#541A2C]/10 to-[#1B305F]/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-[#541A2C] to-[#1B305F] group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
              </Link>
            ))}
            
            {/* Contato Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('contato')}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-800 hover:text-[#541A2C] transition-all duration-300 group"
              >
                <span className="relative z-10">Contato</span>
                <ChevronDown 
                  size={16} 
                  className={`ml-1 transition-transform duration-300 ${
                    activeDropdown === 'contato' ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {activeDropdown === 'contato' && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/20 overflow-hidden">
                  <div className="py-2">
                    <a
                      href="mailto:vcoeps.dadg@gmail.com"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#541A2C]/10 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      vcoeps.dadg@gmail.com
                    </a>
                    <a
                      href="https://api.whatsapp.com/send?phone=5562983306426&text=Olá,%20quero%20falar%20sobre%20o%20COEPS!"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#541A2C]/10 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                      </svg>
                      (15) 98812-3011
                    </a>
                    <a
                      href="https://www.instagram.com/coeps.araguari/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-[#541A2C]/10 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      @coeps.araguari
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Área do Congressista Button */}
            <Link href="/painel" prefetch={false}>
              <button className="ml-4 px-6 py-2.5 bg-gradient-to-r from-[#541A2C] to-[#1B305F] text-white font-semibold rounded-xl hover:from-[#1B305F] hover:to-[#541A2C] transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-white/20">
                Área do Congressista
              </button>
              </Link>
        </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
          <button
            onClick={toggleMenu}
              className="p-2 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-all duration-300"
            >
              {menuAberto ? (
                <X size={24} className="text-gray-800" />
              ) : (
                <Menu size={24} className="text-gray-800" />
              )}
          </button>
        </div>
      </nav>

        {/* Mobile Menu */}
      {menuAberto && (
        <div className="lg:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white/95 backdrop-blur-xl rounded-xl mt-2 border border-white/20 shadow-xl">
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={false}
                  className="block px-3 py-2 text-base font-medium text-gray-800 hover:text-[#541A2C] hover:bg-[#541A2C]/10 rounded-lg transition-all duration-300"
                  onClick={() => setMenuAberto(false)}
                >
                  {item.name}
              </Link>
              ))}
              
              {/* Mobile Contato Links */}
              <div className="px-3 py-2">
                <div className="text-sm font-medium text-gray-600 mb-2">Contato:</div>
                <a
                  href="mailto:vcoeps.dadg@gmail.com"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-[#541A2C]/10 rounded-lg transition-colors duration-200"
                >
                  📧 vcoeps.dadg@gmail.com
                </a>
                <a
                  href="https://api.whatsapp.com/send?phone=5562983306426&text=Olá,%20quero%20falar%20sobre%20o%20COEPS!"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-[#541A2C]/10 rounded-lg transition-colors duration-200"
                >
                  📱 (15) 98812-3011
                </a>
                <a
                  href="https://www.instagram.com/coeps.araguari/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-[#541A2C]/10 rounded-lg transition-colors duration-200"
                >
                  📸 @coeps.araguari
                </a>
              </div>

              {/* Mobile Área do Congressista Button */}
              <div className="px-3 py-2">
                <Link href="/painel" prefetch={false} onClick={() => setMenuAberto(false)}>
                  <button className="w-full px-4 py-2 bg-gradient-to-r from-[#541A2C] to-[#1B305F] text-white font-semibold rounded-lg hover:from-[#1B305F] hover:to-[#541A2C] transition-all duration-300">
                    Área do Congressista
                  </button>
              </Link>
              </div>
            </div>
        </div>
      )}
      </div>
    </header>
  );
};

export default Header;
