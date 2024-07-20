'use client'

// components/Header.js
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
const HeaderPainel = ({ isPayed = true }) => {
    const not_payed = "Realize o pagamento para ter acesso ao site completo"
    const [menuAberto, setMenuAberto] = useState(false);

    const toggleMenu = () => {
        setMenuAberto(!menuAberto);
    };

    return (
        <header className="bg-gray-800 p-4 z-50 w-full sticky top-0">
            <nav className="flex items-center justify-between flex-wrap">
                <div className="flex-shrink-0">
                    <Link href="/">
                        <Image
                            src="/Logo01.png"
                            width={150}
                            height={150}
                            alt="Logo"
                        />
                    </Link>
                </div>
                <div className="hidden lg:flex space-x-4 w-auto flex-wrap ml-auto">
                    <ul className="flex flex-row items-center justify-end content-center space-x-4 flex-wrap">
                        {
                            isPayed ?
                                <>

                                    <li>
                                        <Link href="/painel" className='hover:text-red-500 ease-linear duration-150'>
                                            Início
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/trabalhos" className='hover:text-red-500 ease-linear duration-150'>
                                            Trabalhos
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/minhaProgramacao" className='hover:text-red-500 ease-linear duration-150'>
                                            Programação
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/atividades" className='hover:text-red-500 ease-linear duration-150'>
                                            Atividades
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/pagamentos" className='hover:text-red-500 ease-linear duration-150'>
                                            Pagamentos
                                        </Link>
                                    </li>
                                </>
                                :
                                <li>
                                    <h1 className='hover:text-red-500 ease-linear duration-150 cursor-default'>
                                        {not_payed}
                                    </h1>
                                </li>
                        }
                        <li>
                            <Link href="/api/auth/logout" className='hover:text-red-500 ease-linear duration-150'>
                                <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2">LOGOUT</button>
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className="lg:hidden ml-auto">
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
                        {
                            isPayed ?
                                <>
                                    <li>
                                        <Link href="/painel" className='hover:text-red-500 ease-linear duration-150'>
                                            Início
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/trabalhos" className='hover:text-red-500 ease-linear duration-150'>
                                            Trabalhos
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/minhaProgramacao" className='hover:text-red-500 ease-linear duration-150'>
                                            Programação
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/atividades" className='hover:text-red-500 ease-linear duration-150'>
                                            Atividades
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/painel/pagamentos" className='hover:text-red-500 ease-linear duration-150'>
                                            Pagamentos
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/api/auth/logout" className='hover:text-red-500 ease-linear duration-150'>
                                            <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2">LOGOUT</button>
                                        </Link>
                                    </li>
                                </>
                                :
                                <li>
                                    <h1 className='hover:text-red-500 ease-linear duration-150 cursor-default'>
                                        {not_payed}
                                    </h1>
                                </li>
                        }
                    </ul>
                </div>
            )}
        </header>


    );
};

export default HeaderPainel;
