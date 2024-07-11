'use client'
import { CONFIG_FILES } from "next/dist/shared/lib/constants"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation';
//
//
//
//
export default function A (){
    const route = useRouter()
    const [ isLoadingFetch, setIsLoadingFetch ] = useState(0)
    const [isModalError, setIsModalError] = useState(0) // Pode ser 0 ou alguma string, que sinaliza um erro.
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
            route.push("https://pagamento.sandbox.pagbank.com.br/pagamento?code=53c38755-7ba9-406c-8330-b941b77cd9ad")
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
    return (
        <>
        {
            !isLoadingFetch && isModalError?
            <ModalError handleIsModalError={handleIsModalError} texto={isModalError} />
            :
            ""
        }
        {
            isLoadingFetch?
            <div className="flex items-center content-center justify-center w-full min-h-screen absolute z-50 ">
                <h1 className=" font-extralight text-black lg:text-[40px] animate-pulse">C A R R E G A N D O</h1>
            </div>
            :""
        }
        <div className={`flex flex-col content-center items-center justify-center align-middle bg-[#3E4095] min-h-screen space-y-10 pb-10 ${isLoadingFetch || isModalError?"blur":""}`}>
            <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px] py-5 lg:py-10">Meus Pagamentos</h1>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 space-y-6">
                <div className="text-gray-800 font-bold">
                    <h1 className="text-[14px] lg:text-[20px]">{"Histórico de pagamentos".toLocaleUpperCase()}</h1>
                    <p className="text-red-700 font-semibold">Você ainda não realizou nenhum pagamento.</p>


                </div>
                <div className="flex justify-center lg:justify-start">
                    <button onClick={()=>{handlePostClick()}} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError?"cursor-not-allowed":""}`} disabled={isLoadingFetch || isModalError?true:false}>REALIZAR PAGAMENTO</button>
                </div>
            </div>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 text-black">
                <p1>
                    Realize seu primerio pagamento para confirmar sua inscrição. A confirmação de seu pagamento é realizada de forma <span className="font-bold bg-yellow-400 px-1">automática</span> em até <span className="font-bold bg-yellow-400 px-1">03 dias</span>. 
                    
                </p1>
            </div>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 text-black space-y-3">
                <h1>Em caso de dúvidas ou se o pagamento não for confirmado em até 03 dias, entre em contato com nossa equipe.</h1>
                <div className="flex flex-col lg:flex-row items-center content-center justify-center text-center space-x-2">
                    <div className=" flex-1 flex-col  ">
                        <h1 className="font-bold px-2 lg:bg-yellow-400">Telefone</h1>
                        <h1>64 99999-9999</h1>
                    </div>
                    <div className="flex-1 flex-col ">
                        <h1 className="font-bold px-2 lg:bg-yellow-400">Email</h1>
                        <h1>email@docoeps.com.br</h1>
                    </div>
                    <div className="flex-1 flex-col ">
                        <h1 className="font-bold px-2 lg:bg-yellow-400">Instagram</h1>
                        <h1>@doCoeps</h1>

                    </div>
                </div>
            </div>
        </div>
        </>
    )
}
//
//
//
//
function ModalError ({texto, handleIsModalError}) {
    return (
        <div className="flex items-center content-center justify-center w-full min-h-screen absolute z-50">
            <div className="flex flex-col items-center content-center justify-center bg-white p-5 w-[90%] lg:w-[40%]">
                <h1 className="text-black text-center font-extrabold lg:text-[25px]">ERRO</h1>
                <div className="">
                    <h1 className=" font-extralight text-black lg:text-[35px]">{texto}</h1>
                </div>
                <div className="bg-[#3E4095] text-white font-bold p-3">
                    <button onClick={()=>{handleIsModalError(0)}} >FECHAR</button>
                </div>
            </div>
        </div>
    )
}