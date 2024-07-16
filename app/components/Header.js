'use client'

// components/Header.js
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
const Header = () => {
  const [menuAberto, setMenuAberto] = useState(false);

  const toggleMenu = () => {
    setMenuAberto(!menuAberto);
  };

  return (
    <header className="bg-gray-800 p-4 z-50 w-[100%] sticky">
      <nav className="flex items-center justify-between ">
        <div>
            <Link href="/">
                <Image       
                    src="/Logo01.png"
                    width={150}
                    height={150}
                    alt="Picture of the author"
                />
          </Link>
        </div>
        <div className="hidden lg:flex space-x-4 w-[50%]">
          <ul className="flex flex-row items-center justify-center content-center space-x-4">
            <li>
              <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                Início
              </Link>
            </li>
            <li>
            <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                Organizadores
              </Link>
            </li>
            <li>
            <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                Programação
              </Link>
            </li>
            <li>
            <Link href="/inscricoes" className='hover:text-red-500 ease-linear duration-150'>
                Inscrições
              </Link>
            </li>
            <li>
            <Link href="/trabalhos" className='hover:text-red-500 ease-linear duration-150'>
                Trabalhos
              </Link>
            </li>
            <li>
                <Link href="/anais" className='hover:text-red-500 ease-linear duration-150'>
                Anais
              </Link>
            </li>
            <li>
              <Link href="/#ComponenteContados" className='hover:text-red-500 ease-linear duration-150'>
                Contato
              </Link>
            </li>
            <li>
              <Link href="/inscricoes" className='hover:text-red-500 ease-linear duration-150'>
                Inscreva-se
              </Link>
            </li>
            <li>
              <Link href="/api/auth/login" className='hover:text-red-500 ease-linear duration-150'>
                <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2 ">ÁREA DO CONGRESSITA</button>
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:hidden">
          <button
            onClick={toggleMenu}
            className="text-white hover:text-gray-300 focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {menuAberto ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>
      {menuAberto && (
        <div className="lg:hidden">
            <ul className="mt-4 space-y-2"> 
                <li>
                <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                    Início
                </Link>
                </li>
                <li>
                <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                    Organizadores
                    </Link>
                </li>
                <li>
                <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                    Programação
                    </Link>
                </li>
                <li>
                <Link href="/trabalhos" className='hover:text-red-500 ease-linear duration-150'>
                    Trabalhos
                    </Link>
                </li>
                <li>
                    <Link href="/anais" className='hover:text-red-500 ease-linear duration-150'>
                    Anais
                    </Link>
                </li>
                <li>
                    <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                    Contato
                    </Link>
                </li>
                <li>
                  <Link href="/inscricoes" className='hover:text-red-500 ease-linear duration-150'>
                    Inscreva-se
                  </Link>
                </li>
                <li>
                  <Link href="/api/auth/login" className='hover:text-red-500 ease-linear duration-150'>
                    <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2 ">ÁREA DO CONGRESSITA</button>
                  </Link>
                </li>            
          </ul>
        </div>
      )}
    </header>
  );
};

export default Header;
