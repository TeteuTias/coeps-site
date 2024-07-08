'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRouter } from 'next/navigation';
import Image from "next/image";
//
//
//
export default () =>{
    const { user, error, isLoading } = useUser();
    const router = useRouter()
    if (isLoading) {
        return <h1 className="text-red-800">C A R R E G A N D O</h1>
    }
    
    if (!user) {
        router.push('/')
        return <></>
    }
    
   //<h1 className="text-black">{user?"Voce está logado":"Voce não está logado"}</h1>
    return (
        <div className="flex flex-col justify-center content-center items-center align-top lg:align-middle h-dvh space-y-6 lg:space-y-12">
            <h1 className="text-black">{user?"Voce está logado":"Voce não está logado"}</h1>
            <div className="">
                <Image       
                    src="/LetreiroColorido01.png"
                    width={300}
                    height={180}
                    alt="Picture of the author"
                />
            </div>
            <div className="w-[85%] lg:w-[25%]">
                <Card01 />
            </div>
        </div>
    )
}
function Card01(){
    return (
<div className="flex flex-col shadow-2xl rounded-2xl p-5 lg:p-10 bg-white">
    
    <div className="text-center">
        <h1 className="font-semibold text-black text-[30px] lg:text-[35px]">Primeiros Passos</h1>
    </div>
    <div>
        <p className="text-slate-950 text-center">Antes de continuar, precisamos de algumas informações para concluir seu cadastro. Não se preocupe, vai ser rapidinho!</p>
    </div>
    <div className="flex flex-col space-y-4 pt-4">
        <div className="flex flex-col space-y-1">
            <h1 className="text-slate-950">Nome completo</h1>
            <input className="p-[3px] rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder=". . ."></input>
        </div>
        <div className="flex flex-col space-y-1">
            <h1 className="text-slate-950">Número de telefone</h1>
            <div className="flex-1">
                <input className="p-[3px] w-full rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder="Apenas números"></input>
            </div>
        </div>
        <div className="flex flex-col space-y-1">
            <h1 className="text-slate-950">Cpf</h1>
            <div className="flex-1">
                <input className="p-[3px] w-full rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder="Apenas números"></input>
            </div>
        </div>
        <div className="pt-5">
            <button className="w-full p-2 rounded text-white bg-[#3E4095] font-extralight">CONCLUIR</button>
        </div>
    </div>
</div>



    )
}