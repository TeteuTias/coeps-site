'use client';

import { useEffect, useState } from 'react';

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
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <p className="text-lg">🔄 Carregando...</p>
      </div>
    );

  if (erro)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-red-600">
        <p className="text-lg">❌ {erro}</p>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white text-black px-4">
      <h1 className="text-3xl font-bold mb-6">🔳 Meu QR Code</h1>

      <div className="bg-gray-100 p-6 rounded-lg shadow-md text-center w-full max-w-md">
        <img src={dados?.qrCode} alt="QR Code" className="mx-auto mb-6 w-48 h-48" />
        <div className="text-left text-lg space-y-2">
          <p>
            <strong>ID:</strong> {dados?.id}
          </p>
          <p>
            <strong>Nome:</strong> {dados?.nome}
          </p>
          <p>
            <strong>Email:</strong> {dados?.email}
          </p>
        </div>
      </div>
    </div>
  );
}
