'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, LogOut, Home, FileText, Calendar, Activity, CreditCard, User } from 'lucide-react';

const HeaderPainel = ({ isPayed = true }: { isPayed: boolean }) => {
    const not_payed = "Realize o pagamento para ter acesso ao site completo"
    const [menuAberto, setMenuAberto] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const toggleMenu = () => {
        setMenuAberto(!menuAberto);
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
        { name: 'Início', href: '/', icon: <Home size={16} /> },
        { name: 'Minha Página', href: '/painel', icon: <User size={16} /> },
        { name: 'Trabalhos', href: '/painel/trabalhos', icon: <FileText size={16} /> },
        { name: 'Programação', href: '/painel/minhaProgramacao', icon: <Calendar size={16} /> },
        { name: 'Atividades', href: '/painel/atividades', icon: <Activity size={16} /> },
        { name: 'Pagamentos', href: '/pagamentos', icon: <CreditCard size={16} /> },
    ];

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            isScrolled 
                ? 'bg-[#541A2C] shadow-lg border-b border-[#541A2C]/20' 
                : 'bg-[#541A2C]'
        }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <nav className={`flex items-center justify-between transition-all duration-300 ${
                    isScrolled ? 'h-12 lg:h-14' : 'h-14 lg:h-16'
                }`}>
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <Link href="/" prefetch={false} className="flex items-center group">
                            <div className="relative overflow-hidden rounded-lg transition-all duration-300 group-hover:scale-105">
                                <Image
                                    src="/Logo01.png"
                                    width={isScrolled ? 60 : 90}
                                    height={isScrolled ? 60 : 90}
                                    alt="COEPS Logo"
                                    className="transition-all duration-300"
                                />
                            </div>
                        </Link>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden lg:flex items-center space-x-1">
                        {isPayed ? (
                            <>
                                {menuItems.map((item) => (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        prefetch={false}
                                        className={`relative px-3 py-2 font-medium text-white hover:text-[#D8D9DA] transition-all duration-300 group flex items-center gap-2 ${
                                            isScrolled ? 'text-xs' : 'text-sm'
                                        }`}
                                    >
                                        <span className="opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                                            {item.icon}
                                        </span>
                                        <span className="relative z-10">{item.name}</span>
                                        <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-[#D8D9DA] group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
                                    </Link>
                                ))}
                            </>
                        ) : (
                            <div className="px-3 py-2 text-sm font-medium text-[#541A2C] bg-yellow-100 rounded-lg border border-yellow-200">
                                {not_payed}
                            </div>
                        )}

                        {/* Logout Button */}
                        <Link href="/api/auth/logout" prefetch={false}>
                            <button className={`ml-3 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all duration-300 flex items-center gap-2 ${
                                isScrolled ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2'
                            }`}>
                                <LogOut size={isScrolled ? 14 : 16} />
                                LOGOUT
                            </button>
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="lg:hidden">
                        <button
                            onClick={toggleMenu}
                            className="p-2 rounded-lg bg-[#541A2C]/20 hover:bg-[#541A2C]/30 transition-all duration-300"
                        >
                            {menuAberto ? (
                                <X size={20} className="text-white" />
                            ) : (
                                <Menu size={20} className="text-white" />
                            )}
                        </button>
                    </div>
                </nav>

                {/* Mobile Menu */}
                {menuAberto && (
                    <div className="lg:hidden">
                        <div className="px-2 pt-2 pb-3 space-y-1 bg-white rounded-lg mt-2 border border-gray-200 shadow-lg">
                            {isPayed ? (
                                <>
                                    {menuItems.map((item) => (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            prefetch={false}
                                            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#541A2C] hover:bg-gray-50 rounded-lg transition-all duration-300"
                                            onClick={() => setMenuAberto(false)}
                                        >
                                            <span className="opacity-70">{item.icon}</span>
                                            {item.name}
                                        </Link>
                                    ))}
                                    
                                    {/* Mobile Logout Button */}
                                    <div className="px-3 py-2">
                                        <Link href="/api/auth/logout" prefetch={false} onClick={() => setMenuAberto(false)}>
                                            <button className="w-full px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2">
                                                <LogOut size={16} />
                                                LOGOUT
                                            </button>
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div className="px-3 py-3 text-sm font-medium text-gray-600 bg-yellow-100 rounded-lg border border-yellow-200">
                                    {not_payed}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default HeaderPainel;
