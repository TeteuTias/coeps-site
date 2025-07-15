'use client'

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#3E4095] flex flex-col justify-center content-center items-center">
      <PaginaAreaDoCliente />
    </div>
  );
}

function PaginaAreaDoCliente() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const irParaQRCode = async () => {
    try {
      setLoading(true);

      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (!res.ok || !data?.sub) {
        throw new Error("Usuário não autenticado");
      }

     
      const id = data.sub.replace(/^auth0\|/, '');

      router.push(`/qrCode/${id}`);
    } catch (e) {
      console.error("Erro ao redirecionar:", e);
      alert("Erro ao carregar seu QR Code. Faça login novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center content-center justify-center w-[100%] h-[100%] text-white">
      <div className="w-[80%] lg:w-fit">
        <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Como podemos ajudar hoje?</h1>
      </div>

      <div className="flex flex-col items-center content-center justify-center lg:w-[65%] p-4">
        <div className="grid grid-cols-2 gap-x-10 gap-y-10 lg:grid-cols-3 lg:gap-2 lg:gap-x-10 lg:gap-y-10">

          <Link href="pagamentos" prefetch={false}><CardOpcoes texto="Meus Pagamentos" emoji="💳" /></Link>
          <Link href="painel/trabalhos" prefetch={false}><CardOpcoes texto="Submissão de Trabalhos" emoji="📚" /></Link>
          <Link href="painel/minhaProgramacao" prefetch={false}><CardOpcoes texto="Minha Programação" emoji="📅" /></Link>
          <Link href="painel/minhasInformacoes" prefetch={false}><CardOpcoes texto="Minhas Informações" emoji="ℹ" /></Link>
          <Link href="painel/certificados" prefetch={false}><CardOpcoes texto="Meus Certificados" emoji="✉" /></Link>
          <Link href="painel/atividades" prefetch={false}><CardOpcoes texto="Atividades" emoji="👩‍🎓" /></Link>
          <Link className="flex justify-center items-center bg-transparent col-span-full lg:col-span-full" href="painel/brindes" prefetch={false}><CardOpcoes texto="Brindes" emoji="🎁" /></Link>

          {/* ✅ Botão do QR Code */}
          <button
            onClick={irParaQRCode}
            disabled={loading}
            className="flex justify-center items-center col-span-full lg:col-span-full"
          >
            <CardOpcoes texto={loading ? "Carregando..." : "Meu QR Code"} emoji="🔳" />
          </button>

        </div>
      </div>
    </div>
  );
}

function CardOpcoes({ texto, emoji }: { texto: string, emoji: string }) {
  return (
    <div className="flex flex-col w-32 h-32 lg:w-40 lg:h-32 items-center justify-center shadow-xl bg-white text-center p-2 cursor-pointer">
      <h1 className="text-center font-extralight text-[36px] lg:text-[40px] font-emoji text-gray-800">
        {emoji}
      </h1>
      <h1 className="text-center font-semibold text-slate-950 text-[16px] lg:text-[20px]">
        {texto}
      </h1>
    </div>
  );
}
