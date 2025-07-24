'use client';

import { useEffect, useState } from 'react';
import './style.css';
import Link from 'next/link';

interface UsuarioQR {
  id: string;
  nome: string;
  email: string;
  qrCode: string;
}

export default function MeuQRCodePage() {
  const [dados, setDados] = useState<UsuarioQR | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function buscarQR() {
      try {
        const res = await fetch('/api/get/qrCode');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro inesperado');
        setDados(json);
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    }
    buscarQR();
  }, []);

  if (loading)
    return (
      <div className="qr-main min-h-screen flex items-center justify-center">
        <div className="qr-loader">
          <img
            src="/LetreiroColorido01.png"
            alt="Logo COEPS VII"
            className="qr-loader-logo"
            draggable="false"
          />
          <div className="qr-spinner"></div>
          <p className="qr-loading-text">Carregando seu QR Code...</p>
        </div>
      </div>
    );

  if (erro)
    return (
      <div className="qr-main min-h-screen flex items-center justify-center">
        <div className="qr-error-card">
          <p className="qr-error-icon">❌</p>
          <p className="qr-error-text">{erro}</p>
        </div>
      </div>
    );

  return (
    <div className="qr-main min-h-screen flex flex-col justify-center items-center px-4">
      <Link href="/painel" className="qr-back-btn" aria-label="Voltar para o painel">
        <span className="qr-back-icon">←</span> <span className="qr-back-text">Voltar</span>
      </Link>
      <div className="qr-card bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center">
        <h1 className="qr-title text-3xl font-bold mb-4">Seu QR Code</h1>
        <img src={dados?.qrCode} alt="QR Code" className="qr-img mb-6" />
        <div className="qr-info text-left w-full space-y-2">
          <p><span className="qr-label">ID:</span> {dados?.id}</p>
          <p><span className="qr-label">Nome:</span> {dados?.nome}</p>
          <p><span className="qr-label">Email:</span> {dados?.email}</p>
        </div>
      </div>
    </div>
  );
}
