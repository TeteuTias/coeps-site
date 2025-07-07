'use client'
import { useState } from "react"
import TrackVisibilityChange from "@/app/lib/trackVisibilityChange"
import FireWork from "@/components/Fireworks"
import { useRouter } from 'next/navigation'


export default function SuaInscricaoFoiConfirmada() {
    const [isLoading, setIsLoading] = useState(0)
    const [isFire, setIsFire] = useState(1)
    const router = useRouter()

    const toggleFire = (e) => {
        setIsFire(e)
    }

    const toggleLoading = () => {
        setIsLoading(prev => !prev)
    }

    const confirmarAnimacaoInscricao = async () => {
        toggleLoading()
        try {
          const response = await fetch('/api/post/confirmarAnimacaoInscricao', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
      
          if (!response.ok) {
            throw new Error(`Erro: ${response.status}`);
          }
          router.push("/painel")
          return;
        } catch (error) {
          console.error('Erro ao confirmar animação de inscrição:', error);
          throw error;
        }
      };

    return (
        <>
            <TrackVisibilityChange toggleState={toggleFire} />
            <div className='bg-[#3E4095] h-screen flex items-center justify-center flex-col space-y-4' style={{ filter: isLoading ? "blur(2px)" : "" }}>
                <FireWork activate={isFire} />
                <div>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">SUA INSCRIÇÃO FOI CONFIRMADA</h1>
                    <p className="break-words text-center font-extrabold text-white text-[22px] lg:text-[15px]">Aproveite o evento!</p>
                </div>
                <div>
                    {
                        isLoading ?
                            <button className="bg-white text-[#3E4095] font-extrabold p-2 rounded-lg animate-pulse cursor-not-allowed" disabled>
                                PROSSEGUIR PARA O SITE
                            </button>
                            :
                            <button className="bg-white text-[#3E4095] font-extrabold p-2 rounded-lg animate-pulse"
                            onClick={confirmarAnimacaoInscricao}
                            >
                                PROSSEGUIR PARA O SITE
                            </button>
                    }
                </div>
            </div>
        </>
    )
}