'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation';
import Link from "next/link";
import Image from "next/image";
import TelaLoading from "@/app/components/TelaLoading";
import PaginaErrorPadrao from "@/app/components/PaginaErrorPadrao";
import HeaderPainel from "@/app/components/HeaderPainel";
//
//
//
//
export default function Pagamentos() {
    const { user, isLoading } = useUser();
    const route = useRouter()
    const [isLoadingFetch, setIsLoadingFetch] = useState(0)
    const [isModalError, setIsModalError] = useState(0) // Pode ser 0 ou alguma string, que sinaliza um erro.
    const [data, setData] = useState(undefined)
    const [isFetchingData, setIsFetchingData] = useState(1) // Já começa 01 porque para não renderizar o outro e depois voltar.
    //
    //
    //
    const handleData = (event) => {
        setData(event)
    }
    //
    const handleIsFetchingData = (event) => {
        setIsFetchingData(event)
    }
    //
    const handleIsModalError = (event) => {
        // Considere event igual ao boleado ou texto que voce quer colocar.
        setIsModalError(event)
    }
    //
    const handleIsLoadingFetch = (event) => {
        // Considere event igual ao boleado que voce quer colocar.
        setIsLoadingFetch(event)
    }
    const handlePostClick = async () => {
        // Ativar isLoadingFetch
        handleIsLoadingFetch(1)
        try {
            // Exemplo de dados a serem enviados no corpo da requisição POST
            const data = {
                title: 'Título do Post',
                body: 'Conteúdo do Post',
                userId: 1,
            };

            // Configuração da requisição POST usando fetch
            const response = await fetch('/api/payment/create_payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            // Verifica se a requisição foi bem-sucedida
            if (!response.ok) {
                try {
                    const erro_message = await response.json()
                    console.log(erro_message)
                    throw new Error('Falha ao enviar a requisição POST');


                }
                catch {
                    console.log("!response.ok - catch")
                    throw new Error('Falha ao enviar a requisição POST');
                }
            }

            // Converte a resposta para JSON
            const responseData = await response.json(); // {link:url_para_o_pagamento}

            // Exibe a resposta no console para fins de demonstração
            console.log('Resposta da requisição POST:', responseData);

            route.push(responseData.link)

            // Atualiza o estado com os dados da resposta, se necessário
        } catch (error) {
            console.error('Erro ao enviar a requisição POST:', error);
            handleIsLoadingFetch(0)
            handleIsModalError("Ocorreu algum erro. Tente novamente mais tarde. ")
            // Tratar erros conforme necessário
        }
        finally {
            // nao coloquei o handleIsLoadingFetch(0) porque quando dá certo de criar o pagamento, quero que ele seja redirecionado direto, sem chances de dar setstate.

        }
    };
    const handlePostClick2 = async () => {
        // Ativar isLoadingFetch
        handleIsLoadingFetch(1)
        try {
            if (!data || !data.pagamento.lista_pagamentos || data?.pagamento?.lista_pagamentos?.length == 0) {
                console.log("ERROR: !Data || !data.lista_pagamentos")
                // Configurar o erro aqui...
            }
            const statusFiltro = ["PENDING"]
            const filtroLinks = data.pagamento.lista_pagamentos.filter(item => statusFiltro.includes(item.status)).map(item => item.invoiceUrl)[0] // [0] pq tecnicamente, deve haver só um, se tudo estiver nos conformes.
            handleIsLoadingFetch(0)
            route.push(filtroLinks)


        }
        catch (error) {
            console.log("ERROR: CATCH HANDLEPOSTCLICK2")
            console.log(error)
            handleIsLoadingFetch(0)
        }
        //
    };
    //
    const url_get_usuariosPagamentos = "/api/get/usuariosPagamentos"
    //
    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                // Configuração da requisição GET usando fetch
                const response = await fetch(url_get_usuariosPagamentos, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                // Verifica se a requisição foi bem-sucedida
                if (!response.ok) {
                    console.log(response)
                    throw new Error('Falha ao enviar a requisição GET');
                }

                // Converte a resposta para JSON
                const responseData = await response.json();

                // Exibe a resposta no console para fins de demonstração
                console.log('Resposta da requisição GET:', responseData);

                handleIsFetchingData(0)
                handleData(responseData.data)
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);

                // Tratar erros conforme necessário
            }
        };
        if (!isLoading) {
            enviarRequisicaoGet();
        }
    }, [isLoading, user]);
    //
    if (isFetchingData) {
        return <TelaLoading />
    }
    //
    return (
        <>
            <HeaderPainel isPayed={data?.pagamento?.situacao ?? 0} />
            {
                !isLoadingFetch && isModalError ?
                    <ModalError handleIsModalError={handleIsModalError} texto={isModalError} />
                    :
                    ""
            }
            {
                isLoadingFetch ?
                    <div className="flex items-center content-center justify-center w-full min-h-screen absolute z-50 ">
                        <h1 className=" font-extralight text-black lg:text-[40px] animate-pulse">C A R R E G A N D O</h1>
                    </div>
                    : ""
            }
            <div className={`flex flex-col content-center items-center align-middle min-h-screen ${isLoadingFetch || isModalError ? "blur" : ""}`}>
                <div className="bg-[#3E4095] w-full p-5 lg:p-16">
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Meus Pagamentos</h1>
                </div>
                <div className="  w-full ">
                    <div className="flex content-center items-center justify-center py-16  bg-white">
                        <div className=" p-4 space-y-6 w-full md:w-[60%]">
                            <div className="text-gray-800 font-bold">
                                <h1 className="text-[20px] lg:text-[20px] font-emoji">{"ℹHISTÓRICO DE PAGAMENTOS"}</h1>
                                <p className="text-red-700 font-semibold">{data.pagamento.lista_pagamentos?.length ? "- " + data.pagamento.lista_pagamentos?.length.toString().padStart(2, '0') + " pagamentos encontrados" : "Você ainda não realizou nenhum pagamento."}</p>
                                <div className="flex flex-col ">
                                    {
                                        data.pagamento.lista_pagamentos.length ?
                                            <div className="flex flex-col items-start content-start justify-start pt-10 space-y-7 w-[95%] lg:w-[65%]">
                                                {
                                                    data.pagamento.lista_pagamentos?.map((value, index) => {
                                                        console.log(value)

                                                        return (
                                                            <div key={index} className="">
                                                                <CardPagamentos invoiceUrl={value.invoiceUrl} valor={value.value} nome={'nome'} data_formatada={value.dateCreated} invoiceNumber={value.invoiceNumber} status={value.status} description={value.description} />
                                                            </div>
                                                        )
                                                    })
                                                }
                                            </div>
                                            :
                                            ""
                                    }
                                </div>

                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col content-center items-center justify-center py-16 bg-[#3E4095]">
                        <div className="w-[100%] p-4 text-black space-y-2 md:w-[60%]">
                            <h1 className="text-[20px] lg:text-[20px] text-slate-100 font-bold font-emoji">{"ℹSITUAÇÃO DE INSCRIÇÃO"}</h1>
                            <div className="">
                                {!data.pagamento.situacao || data.pagamento.situacao == 2 ?
                                    <p1 className="text-white">
                                        Realize seu primerio pagamento para confirmar sua inscrição. A confirmação de seu pagamento é realizada de forma <span className="font-bold bg-yellow-400 px-1">automática</span> em até <span className="font-bold bg-yellow-400 px-1">03 dias</span>.
                                    </p1>
                                    :
                                    <p1 className="text-white">
                                        Sua inscrição foi <span className="font-bold bg-yellow-400 px-1">confirmada</span>.<span className=""> Aproveite o evento</span>!
                                    </p1>
                                }
                            </div>
                            <div>
                                {data.pagamento.situacao == 0 ?
                                    <div className="flex justify-center lg:justify-start">
                                        <button onClick={() => { handlePostClick() }} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError ? "cursor-not-allowed" : ""}`} disabled={isLoadingFetch || isModalError ? true : false}>REALIZAR INSCRIÇÃO</button>
                                    </div>
                                    : ""
                                }
                                {data.pagamento.situacao == 2 ?
                                    <div className="flex justify-center lg:justify-start">
                                        <button onClick={() => { handlePostClick2() }} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError ? "cursor-not-allowed" : ""}`} disabled={isLoadingFetch || isModalError ? true : false}>REALIZAR INSCRIÇÃO</button>
                                    </div>
                                    : ""
                                }
                            </div>
                        </div>
                    </div>
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" fill="#3e4095" >
                            <path className="" d="M761.9,44.1L643.1,27.2L333.8,98L0,3.8V0l1000,0v3.9"></path>
                        </svg>
                    </div>
                    <div className="flex flex-col content-center items-center justify-center py-16 bg-white">
                        <div className="md:w-[60%] p-4 text-black space-y-2">
                            <h1 className="text-[20px] lg:text-[20px] text-gray-800 font-bold font-emoji">{"ℹCONTATO"}</h1>
                            <h1>Em caso de dúvidas ou se o pagamento não for confirmado em até 03 dias, entre em contato com nossa equipe.</h1>
                            <div className="flex flex-col lg:flex-row items-center content-center justify-center text-center space-x-2">
                                <div className=" flex-1 flex-col  ">
                                    <h1 className="font-bold px-2">Telefone</h1>
                                    <h1>64 99999-9999</h1>
                                </div>
                                <div className="flex-1 flex-col ">
                                    <h1 className="font-bold px-2">Email</h1>
                                    <h1>email@docoeps.com.br</h1>
                                </div>
                                <div className="flex-1 flex-col ">
                                    <h1 className="font-bold px-2">Instagram</h1>
                                    <h1>@doCoeps</h1>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

const CardPagamentos = ({ valor_total = "ERROR", data_formatada = "ERROR", invoiceNumber = "ERROR", status = "ERROR", description = "ERROR", valor = "ERROR", invoiceUrl="/pagamentos" }) => {
    // Arrumando a DATA
    //
    //
    //
    /*
        Dicionário
        ACTIVE => Aguardando
    
    */
    switch (true) { // "Traduz o que está escrito no status."
        case status == "PAYMENT_CONFIRMED":
            status = "PAGO"
            break
        case status == "PAYMENT_OVERDUE":
            status = "CANCELADO"
            break
        case status == "PENDING":
            status = "PAGAMENTO PENDENTE"
            break

        case status == "PAYMENT_REFUNDED":
            status = "COBRANÇA ESTORNADA"
            break
        case status == "PAYMENT_REFUND_DENIED":
            status = "ESTORNO NEGADO"
            break
        case status == "PAYMENT_PARTIALLY_REFUNDED":
            status = "PARCIALMENTE ESTORNADO"
            break
        case status == "PAYMENT_REFUND_IN_PROGRESS":
            status = "PROCESSANDO ESTORNO"
            break
    }

    return (
        <Link target="_blank" prefetch={false} href={invoiceUrl}>
            <div className="shadow-[0px_0px_5px_7px_rgba(0,0,0,0.02)] p-4 rounded-xl cursor-pointer relative">
                <div className="flex flex-row justify-center items-center content-center align-middle absolute z-10 p-1 bg-[#ff8952] top-[-15px] left-[-6px] space-x-[3px] rounded-sm">
                    {
                        valor == "ERROR" ?
                            <h1 className="font-bold text-[13px]">{valor}</h1>
                            :
                            <div className="text-[white] flex flex-row space-x-[3px]">
                                <h1 className="font-bold text-[13px]">R$</h1>
                                <p className="font-serif text-[13px]">{valor}</p>
                            </div>
                    }
                </div>
                <div className="flex flex-row space-x-8">
                    <div className="flex w-[20%]">
                        <p className="text-red-600 font-mono text-[13px] lg:text-[13px]">{data_formatada}</p>
                    </div>
                    <div className="flex">
                        <p className="text-red-600 font-mono text-[13px] lg:text-[13px]">{description}</p>
                    </div>
                </div>
                <div className="flex flex-row justify-start items-center content-center">
                    <div className="flex-1 w-[80%]">
                        <p>#{invoiceNumber}</p>
                    </div>
                    <div className="flex flex-row">
                        <h1>{status}</h1>
                    </div>
                </div>
                <p className="text-[13px] font-thin">Clique para acessar</p>
            </div>
        </Link>
    )
}

function ModalError({ texto, handleIsModalError }) {
    return (
        <div className="flex items-center content-center justify-center w-full min-h-screen absolute z-50">
            <div className="flex flex-col items-center content-center justify-center bg-white p-5 w-[90%] lg:w-[40%]">
                <h1 className="text-black text-center font-extrabold lg:text-[25px]">ERRO</h1>
                <div className="">
                    <h1 className=" font-extralight text-black lg:text-[35px]">{texto}</h1>
                </div>
                <div className="bg-[#3E4095] text-white font-bold p-3">
                    <button onClick={() => { handleIsModalError(0) }} >FECHAR</button>
                </div>
            </div>
        </div>
    )
}