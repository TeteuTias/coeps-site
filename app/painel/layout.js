'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import TelaLoading from "../components/TelaLoading";
import PaginaErrorPadrao from "../components/PaginaErrorPadrao";

export default function Layout({ children }) { // só tá existindo apra fazer as verificações.
    /*

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
                    const response = await fetch('/api/get/usuariosInformacoes', { cache: 'no-cache' });
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
        else {
            setFetching(0)
        }

    }, [user, isLoading]);
    useEffect(() => {
        const verf = () => {
            try {
                // primerio ve se esta carregadno
                if (isLoading || isFetching) {
                    return <TelaLoading />
                }
                // depois, se nao estiver carregando, sai do site
                if (!user && !isLoading && !isFetching) {
                    console.log("push ./")
                    router.push('/')
                    return <></>
                }
                // aqui, ja esta carregado e ja esta no site, entao vamos ver se tem isPos...
                if (user && !isLoading && !isFetching && data && data.data?.isPos_registration === 0) { // redirecionando se ele estiver logado, não estiver carregando e se isPos_registration == 0
                    console.log("push /painel/updateData")
                    router.push('/painel/updateData')
                    return <></>
                }
                // agora vamos ver se pagou, se nao pagou vai para a parte de pagamento.
                if (user && !isLoading && !isFetching && data && (data.data?.pagamento.situacao === 0 || data.data?.pagamento.situacao === 2)) { // redirecionando se ele estiver logado, não estiver carregando e se isPos_registration == 0
                    console.log('push /painel/pagamentos')
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
        if (!isLoading) {
            verf();

        }
    }, [user, isLoading, data, isFetching, router])
    //console.log(`${isLoading} || ${isFetching} || ${!isOk} || ${!data}`)
                 */
    return (
        <div className="min-h-screen">
            {children}
        </div>
    )

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