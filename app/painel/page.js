'use client'

import Link from "next/link";
import { useState } from "react";


import Image from "next/image";
//
//
//
//
export default () =>{

    return(
        <>
            <Header />
        <div className="min-h-screen bg-[#3E4095] flex flex-col justify-center content-center items-center">
            <PaginaAreaDoCliente />
        </div>
        </>
    )
}
//
//
function PaginaAreaDoCliente () { // como é uma pagina, pega toda a tela para ele com w-[100%]
    return (
        <>
        <div className="flex flex-col items-center content-center justify-center w-[100%] h-[100%] bg-[#3E4095] text-white pt-10 lg:pt-0">
            <div className="w-[80%] lg:w-fit">
                <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Como podemos ajudar hoje?</h1>
            </div>
            <div className="flex flex-col items-center content-center justify-center lg:w-[65%] p-4 ">
                <div className="grid grid-cols-2 gap-x-10 gap-y-10 lg:grid-cols-3 lg:gap-2 lg:gap-x-10 lg:gap-y-10">
                    <Link href="painel/pagamentos"><CardOpcoes texto="Meus Pagamentos" emoji="💳"/></Link>
                    <CardOpcoes texto="Submição de Trabalhos" emoji="📚"/>
                    <Link href="painel/minhaProgramacao"><CardOpcoes texto="Minha Programação" emoji="📅"/></Link>
                    <CardOpcoes texto="Minhas Informações" emoji="ℹ"/>
                    <CardOpcoes texto="Meus Certificados" emoji="✉"/>
                    <CardOpcoes texto="Minicursos" emoji="👩‍🎓"/>
                </div>
            </div>
        </div>
        </>
    )
}
//
function CardOpcoes({texto,emoji}) {
    return (
        <div className="flex flex-col w-32 h-32 lg:w-40 lg:h-32 items-center justify-center shadow-xl bg-white text-center p-2 cursor-pointer">
            <h1 className="text-center font-extralight text-slate-950 text-[36px] lg:text-[40px]">
                {emoji}
            </h1>
            <h1 className="text-center font-semibold text-slate-950 text-[16px] lg:text-[20px]">
                {texto}
            </h1>                
        </div>
    )
}
//
//
//
const Header = () => {
  const [menuAberto, setMenuAberto] = useState(false);

  const toggleMenu = () => {
    setMenuAberto(!menuAberto);
  };

  return (
    <header className="bg-gray-800 p-4 z-50 w-[100%] fixed top-0">
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
        <div className="hidden space-x-4 lg:flex lg:justify-end  w-[50%]">
          <ul className="flex flex-row items-center justify-center content-center space-x-4 lg:space-x-10">
            <li>
              <Link href="/painel/" className='hover:text-red-500 ease-linear duration-150'>
                Área do Congressista
              </Link>
            </li>
            <li>
            <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                Trabalhos
              </Link>
            </li>
            <li>
            <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                Minha programação
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
              <Link href="/api/auth/login" className='hover:text-red-500 ease-linear duration-150'>
                <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2 ">LOGOUT</button>
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
              <Link href="/painel/" className='hover:text-red-500 ease-linear duration-150'>
                Área do Congressista
              </Link>
            </li>
            <li>
            <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                Trabalhos
              </Link>
            </li>
            <li>
            <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                Minha programação
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
              <Link href="/api/auth/login" className='hover:text-red-500 ease-linear duration-150'>
                <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2 ">LOGOUT</button>
              </Link>
            </li>            
          </ul>
        </div>
      )}
    </header>
  );
};
