'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import TelaLoading from "../components/TelaLoading";
import PaginaErrorPadrao from "../components/PaginaErrorPadrao";
//
//
//
export default () =>{
    const { user, error, isLoading } = useUser();
    const router = useRouter()
    const [isFetching, setFetching] = useState(1)
    const [data, setData] = useState(null)
    //
    //
    useEffect(() => {
        if (user && !isLoading) {
            const fetchData = async () => {
                try {
                    const response = await fetch('/api/get/usuariosInformacoes');
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    const result = await response.json();
                    setData(result);
                } catch (error) {
                    
                    console.log("Error FETCH PAINEL - useEffect")
                } finally {
                    setFetching(0)
                }
            };
            fetchData();
        }
    }, [user, isLoading]); 
    //
    //
    if (isLoading || isFetching) {
        return <TelaLoading />
    }
    
    if (!user && !isLoading) {
        router.push('/')
        return <></>
    }
    if (user && !isLoading && data && data.data.isPos_registration == 0) { // redirecionando se ele estiver logado, não estiver carregando e se isPos_registration == 0
        router.push('/painel/updateData')
        return <></>
    }
    if (!data) { // dive que fazer para "qualquer coisa". é a ultima etapa para evitar uma merda tremenda
        return <PaginaErrorPadrao />
    }
    return(
        <>
            <button className="p-4 w-5 text-black" onClick={()=>{console.log(data)}}> CLIQUE</button>
            <h1 className="text-black">{user?"Voce está logado":"Voce não está logado"}</h1>
            <h1 className="text-black">{user?.email}</h1>
            <h1 className="text-black"></h1>

            <div className="bg-yellow-300">
                <Link href="/api/auth/logout"><h1>LogOut</h1></Link>
            </div>
            <button className="bg-yellow-500 p-10" onClick={()=>{console.log(user["email"])}}>X</button>
        </>
    )
}