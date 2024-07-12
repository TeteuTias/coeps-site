'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation';
import Link from "next/link";
import Image from "next/image";
import TelaLoading from "@/app/components/TelaLoading";
import PaginaErrorPadrao from "@/app/components/PaginaErrorPadrao";
//
//
//
//
export default function A (){
    const { user , isLoading } = useUser();
    const route = useRouter()
    const [ isLoadingFetch, setIsLoadingFetch ] = useState(0)
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
        enviarRequisicaoGet();
    }, [!isLoading]);
    //
    if ( isFetchingData ) {
        return <TelaLoading />
    }
    //
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
        <Header situacao={data.pagamento.situacao}/>
        <div className={`flex flex-col content-center items-center justify-center align-middle bg-[#3E4095] min-h-screen space-y-10 pb-10 ${isLoadingFetch || isModalError?"blur":""}`}>
            <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Meus Pagamentos</h1>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 space-y-6">
                <div className="text-gray-800 font-bold">
                    <h1 className="text-[14px] lg:text-[20px]">{"Histórico de pagamentos".toLocaleUpperCase()}</h1>
                    <p className="text-red-700 font-semibold">{data.pagamento.lista_pagamentos?.length?"- "+data.pagamento.lista_pagamentos?.length.toString().padStart(2, '0')+" pagamentos encontrados":"Você ainda não realizou nenhum pagamento."}</p>
                    {
                        data.pagamento.lista_pagamentos.length?
                        <div className="flex flex-col pt-10 space-y-7">
                            {
                                data.pagamento.lista_pagamentos?.map((value,index) =>{
                                    var valor = value.items.reduce((acc, curr) => acc + curr.unit_amount,0)
                                    var nome  = value.items[0].name
                                    //console.log(value)

                                    return (
                                        <div key={index} className=""> 
                                            <CardPagamentos nome={nome} valor_total={valor} status={value.status} data={value.created_at}/>
                                        </div>
                                    )
                                })
                            }
                        </div>
                            :
                            ""
                    }

                </div>
                { !data.pagamento.situacao?
                <div className="flex justify-center lg:justify-start">
                    <button onClick={()=>{handlePostClick()}} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError?"cursor-not-allowed":""}`} disabled={isLoadingFetch || isModalError?true:false}>REALIZAR PAGAMENTO</button>
                </div>
                :<h1 disabled>.</h1>
                }
            </div>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 text-black">
                { !data.pagamento.situacao?
                    <p1>
                        Realize seu primerio pagamento para confirmar sua inscrição. A confirmação de seu pagamento é realizada de forma <span className="font-bold bg-yellow-400 px-1">automática</span> em até <span className="font-bold bg-yellow-400 px-1">03 dias</span>. 
                    </p1>
                    :
                    <p1>
                        Sua inscrição foi <span className="font-bold bg-yellow-400 px-1">confirmada</span>. Você não precisa pagar mais nada! Apenas <span className="font-bold bg-yellow-400 px-1">aproveite o evento</span>.
                    </p1>
                }
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
const CardPagamentos = ({items=[],  metodo_pagamento="ERROR",nome="ERROR",status="ERROR", data="DATA", valor_total="ERROR"}) =>{
    // Arrumando a DATA
    try {
        var date = new Date(data);
        var data_formatada = date.toLocaleDateString()
    }
    catch {
        var data_formatada = "ERROR"
    }

    //
    //
    //
    /*
        Dicionário
        ACTIVE => Aguardando
    
    */
    switch (true){ // "Traduz o que está escrito no status."
        case status == "ACTIVE":
            status = "Aguardando Pagamento"
            break
        case status == "PAID":
            status = "PAGO"
            break
        case status == "IN_ANALYSIS":
            status = "EM ANÁLISE"
            break
        case status == "DECLINED":
            status = "RECUSADO"    
            break
        case status == "CANCELED":
            status = "CANCELADO"  
            break
        case status == "WAITING":
            status = "Aguardando Pagamento"
            break
    }
        
    return (
        <div className="shadow-[0px_0px_5px_7px_rgba(0,0,0,0.05)] p-4 rounded-xl cursor-pointer relative">
            <div className="flex flex-row justify-center items-center content-center align-middle absolute z-10 p-1 bg-[#ff8952] top-[-15px] left-[-6px] space-x-[3px] rounded-sm">
                {
                    valor_total == "ERROR"?
                    <h1 className="font-bold text-[13px]">{valor_total}</h1>
                    :
                    <div className="text-[white] flex flex-row space-x-[3px]">
                        <h1 className="font-bold text-[13px]">R$</h1>
                        <p className="font-serif text-[13px]">{(valor_total / 100).toFixed(2)}</p>
                    </div>
                }
            </div>
            <div className="flex flex-row space-x-8">
                <div className="flex w-[20%]">
                    <p className="text-red-600 font-mono text-[13px] lg:text-[13px]">{data_formatada}</p>
                </div>
                <div className="flex">
                    <p className="text-red-600 font-mono text-[13px] lg:text-[13px]">{nome}</p>
                </div>
            </div>
            <div className="flex flex-row justify-start items-center content-center">
                <div className="flex-1 w-[80%]">
                    <p>CHECKOUT</p>
                </div>
                <div className="flex flex-row">
                    <h1>{status}</h1>
                </div>
            </div>
        </div>
    )
}
//
const Header = ({situacao}) => {
    //
    //
    //
    const [menuAberto, setMenuAberto] = useState(false);
  
    const toggleMenu = () => {
      setMenuAberto(!menuAberto);
    };
  
    return (
      <header className="bg-gray-800 p-4 z-50 w-[100%] sticky top-0">
        <nav className="flex items-center justify-between ">
          <div>
              <Link href="/">
                  <Image       
                      src="/Logo01.png"
                      width={150}
                      height={150}
                      alt="Picture of the author"
                  />
            </Link>
          </div>
          <div className="hidden space-x-4 lg:flex lg:justify-end  w-[50%]">
            <ul className="flex flex-row items-center justify-center content-center space-x-4 lg:space-x-10">
                {
                    situacao?
                    <>
                        <li>
                            <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                            Área do Congressista
                            </Link>
                        </li>
                        <li>
                        <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                            Trabalhos
                            </Link>
                        </li>
                        <li>
                        <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                            Minha programação
                            </Link>
                        </li>
                        <li>
                            <Link href="/anais" className='hover:text-red-500 ease-linear duration-150'>
                                Anais
                            </Link>
                        </li>
                        <li>
                            <Link href="/#ComponenteContados" className='hover:text-red-500 ease-linear duration-150'>
                            Contato
                            </Link>
                        </li>
                    </>
                    :
                    <li>
                        <Link href="" className='hover:text-red-500 ease-linear duration-150'>
                        {"Complete o cadastro para ter acesso total ao site".toUpperCase()}
                        </Link>
                    </li>
                }
              <li>
                <Link href="/api/auth/login" className='hover:text-red-500 ease-linear duration-150'>
                  <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2 ">LOGOUT</button>
                </Link>
              </li>
            </ul>
          </div>
          <div className="lg:hidden">
            <button
              onClick={toggleMenu}
              className="text-white hover:text-gray-300 focus:outline-none"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {menuAberto ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </nav>
        {menuAberto && (
          <div className="lg:hidden">
              <ul className="mt-4 space-y-2"> 
                {
                    situacao?
                    <>
                        <li>
                            <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                            Área do Congressista
                            </Link>
                        </li>
                        <li>
                        <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                            Trabalhos
                            </Link>
                        </li>
                        <li>
                        <Link href="/" className='hover:text-red-500 ease-linear duration-150'>
                            Minha programação
                            </Link>
                        </li>
                        <li>
                            <Link href="/anais" className='hover:text-red-500 ease-linear duration-150'>
                                Anais
                            </Link>
                        </li>
                        <li>
                            <Link href="/#ComponenteContados" className='hover:text-red-500 ease-linear duration-150'>
                            Contato
                            </Link>
                        </li>
                    </>
                    :
                    <li>
                        <Link href="" className='hover:text-red-500 ease-linear duration-150'>
                            {"Complete o cadastro para ter acesso total ao site".toUpperCase()}
                        </Link>
                    </li>
                }
              <li>
                <Link href="/api/auth/login" className='hover:text-red-500 ease-linear duration-150'>
                  <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold border-gray-800 hover:border-red-500 hover:bg-white hover:text-red-500 border-2 ">LOGOUT</button>
                </Link>
              </li>            
            </ul>
          </div>
        )}
      </header>
    );
};
  
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