'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import TelaLoading from "../components/TelaLoading";
import PaginaErrorPadrao from "../components/PaginaErrorPadrao";

export default ({ children }) => { // só tá existindo apra fazer as verificações.
    const { user, error, isLoading } = useUser();
    const router = useRouter()
    const [isFetching, setFetching] = useState(1)
    const [data, setData] = useState(null)
    const [isOk, setIsOk] = useState(0)
    //
    // VERIFICANDO SE AUTH ESTÁ CARREGANDO
    useEffect(() => {
        if (user && !isLoading) {
            const fetchData = async () => {
                try {
                    const response = await fetch('/api/get/usuariosInformacoes',{cache:'no-cache'});
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
    }, [user, !isLoading]); 
    useEffect(()=>{
        const verf = async () =>{
            try {
                // primerio ve se esta carregadno
                if (isLoading || isFetching) {
                    return <TelaLoading />
                }
                // depois, se nao estiver carregando, sai do site
                if (!user && !isLoading && !isFetching) {
                    router.push('/')
                    return <></>
                }
                // aqui, ja esta carregado e ja esta no site, entao vamos ver se tem isPos...
                if (user && !isLoading && !isFetching && data && data.data?.isPos_registration === 0) { // redirecionando se ele estiver logado, não estiver carregando e se isPos_registration == 0
                    router.push('/painel/updateData')
                    return <></>
                }
                // agora vamos ver se pagou, se nao pagou vai para a parte de pagamento.
                if (user && !isLoading && !isFetching && data && data.data?.pagamento.situacao === 0) { // redirecionando se ele estiver logado, não estiver carregando e se isPos_registration == 0
                    router.push('/painel/pagamentos')
                    return <></>
                } 
            }
            catch (error) {
                console.log("error catch /painel")
                console.log(error)
                return <PaginaErrorPadrao />
            }
            finally {
                setIsOk(1)
            }
        };
        verf();
    }, [user, !isLoading, data])

    return (
        <div className="min-h-screen">
            {
                isLoading || isFetching || !isOk || !data ? (
                    <TelaLoading />
                ) : (
                    children
                )
            }

        </div>
    )
}
/**
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
    try {
        if (isLoading || isFetching) {
            return <TelaLoading />
        }
        
        if (!user && !isLoading && !isFetching) {
            router.push('/')
            return <></>
        }
        if (user && !isLoading && data && data.data?.isPos_registration === 0) { // redirecionando se ele estiver logado, não estiver carregando e se isPos_registration == 0
            router.push('/painel/updateData')
            return <></>
        }
        if (!data && !isLoading && !isFetching) { // dive que fazer para "qualquer coisa". é a ultima etapa para evitar uma merda tremenda
            console.log("error !data && !isLoading && !isFetching /painel")
            return <PaginaErrorPadrao />
        }
    }
    catch (error) {
        console.log("error catch /painel")
        console.log(error)
        return <PaginaErrorPadrao />
}
 */