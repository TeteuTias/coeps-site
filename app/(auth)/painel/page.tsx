'use client'

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  Sparkles,
  QrCode
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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const res = await fetch("/api/get/usuariosInformacoes");
        const data = await res.json();
        setUserId(data?.data?._id || null);
      } catch (e) {
        setUserId(null);
      }
    };
    fetchUserId();
  }, []);

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
        <div style={{ opacity: userId ? 1 : 0.5, pointerEvents: userId ? 'auto' : 'none' }}>
          <Link href={`/qrCode/${userId ?? 'null'}`} prefetch={false}>
            <CardOpcoes texto="Meu QR Code" icon={<QrCode size={48} />} />
          </Link>
        </div>
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
