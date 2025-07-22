'use client'

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { 
  CreditCard, 
  FileText, 
  Calendar, 
  User, 
  Award, 
  GraduationCap, 
  Gift,
  DollarSign,
  BookOpen,
  Clock,
  UserCheck,
  Activity,
  Sparkles
} from 'lucide-react';
import './style.css';

export default function Page() {
  return (
    <div className="painel-main">
      {/* Partículas de fundo */}
      <div className="painel-bg-particles">
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
        <div className="painel-particle"></div>
      </div>

      <div className="painel-container">
        <PaginaAreaDoCliente />
      </div>
    </div>
  )
}

function PaginaAreaDoCliente() {
  return (
    <>
      <div className="painel-title">
        <h1>Como podemos ajudar hoje?</h1>
      </div>
      
      <div className="painel-grid">
        <Link href="pagamentos" prefetch={false}>
          <CardOpcoes texto="Meus Pagamentos" icon={<DollarSign size={48} />} />
        </Link>
        <Link href="painel/trabalhos" prefetch={false}>
          <CardOpcoes texto="Submissão de Trabalhos" icon={<BookOpen size={48} />} />
        </Link>
        <Link href="painel/minhaProgramacao" prefetch={false}>
          <CardOpcoes texto="Minha Programação" icon={<Clock size={48} />} />
        </Link>
        <Link href="painel/minhasInformacoes" prefetch={false}>
          <CardOpcoes texto="Minhas Informações" icon={<UserCheck size={48} />} />
        </Link>
        <Link href="painel/certificados" prefetch={false}>
          <CardOpcoes texto="Meus Certificados" icon={<Award size={48} />} />
        </Link>
        <Link href="painel/atividades" prefetch={false}>
          <CardOpcoes texto="Atividades" icon={<Activity size={48} />} />
        </Link>
        <Link href="painel/brindes" prefetch={false}>
          <CardOpcoes texto="Brindes" icon={<Sparkles size={48} />} special={true} />
        </Link>
      </div>
    </>
  )
}

function CardOpcoes({ texto, icon, special = false }) {
  return (
    <div className={`painel-card ${special ? 'painel-card-special' : ''}`}>
      <div className="painel-card-icon">
        {icon}
      </div>
      <h2 className="painel-card-text">{texto}</h2>
    </div>
  )
}
