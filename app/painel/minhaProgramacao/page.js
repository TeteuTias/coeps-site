'use client'
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default () => {
    const [isFetching, setIsFetching] = useState(1)
    const [data, setData] = useState(undefined)
    
    //
    //
    const handleIsFetching = (event) => { 
        setIsFetching(event)
    }
    const handleData = (event) => { 
        setData(event)
    }
    //
    //
    function organizeEventsByDate(events) {
        // Realizando algumas verificações
        if (!events) return 0;
        const organizedEvents = {};
      
        // Helper function to format date as "YYYY-MM-DD"
        const formatDate = (date) => {
          const d = new Date(date);
          return d.toISOString().split('T')[0];
        };
      
        // Helper function to compare events by their start date
        const compareEvents = (a, b) => {
          const dateA = new Date(a.timeline[0].date_init);
          const dateB = new Date(b.timeline[0].date_init);
          return dateA - dateB;
        };
      
        const addEventsToDict = (eventsArray) => {
          eventsArray.forEach(event => {
            const eventDate = formatDate(event.timeline[0].date_init);
            if (!organizedEvents[eventDate]) {
              organizedEvents[eventDate] = [];
            }
            organizedEvents[eventDate].push(event);
          });
        };
      
        // Add all events from both minicursos and palestras
        addEventsToDict(events.minicursos);
        addEventsToDict(events.palestras);
      
        // Sort events within each date
        for (const date in organizedEvents) {
          organizedEvents[date].sort(compareEvents);
        }
        
        return Object.keys(organizedEvents).length?organizedEvents:undefined;
    }
    //
    //
    useEffect(() => {
        const enviarRequisicaoGet = async () => {
        try {
            // Configuração da requisição GET usando fetch
            const response = await fetch('/api/get/usuariosProgramacao', {
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

            handleIsFetching(0)
            handleData({"data":organizeEventsByDate(responseData)})
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);

            // Tratar erros conforme necessário
            }
        };
        enviarRequisicaoGet();
    }, [] );
    //
    //
    return (
        <div className="bg-[#3E4095] min-h-screen pb-10">
            <Header/>
            <div className="flex flex-col content-center align-middle items-center justify-center space-y-10">
                <div className="w-[85%] lg:w-[60%] text-justify space-y-5">
                    <h1 onClick={()=>{console.log(data)}}>CLIQUE AQUI</h1>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]"
                        onClick={()=>{
                            console.log(organizeEventsByDate(data))
                        }}
                    >Minha Programação</h1>
                    <h1>Aqui está o seu cronograma de eventos! Todos os eventos obrigatórios e aqueles em que você se inscreveu estão organizados para que você 
                        não fique perdido. Não se esqueça de se inscrever nos minicursos! Clicando nos cards, você consegue mais informações sobre o evento presente
                        na sua agenda.
                    </h1>
                </div>
                <div className="relative w-[85%] lg:w-[60%] grid grid-cols-1 lg:grid-cols-3 gap-y-10 lg:gap-x-4">
                    {
                        isFetching ?
                        (<>
                            <CardProgramacaoLoading responsive={0} cor_primaria={"#FF7F50"}/>
                            <CardProgramacaoLoading responsive={1} cor_primaria={"#DC143C"}/>
                            <CardProgramacaoLoading responsive={1} cor_primaria={"#FA8072"}/>
                        </>) : ""
                    }
                    {
                        !isFetching && data.data ?
                            Object.keys(data.data).map(key => {
                                // key - 2024-07-16
                                return <CardProgramacao dateKey={key} cor_primaria={'#FF7F50'} event={data.data[key]} key={Math.floor(Math.random() * 100)} />

                                /*
                                for (let i = 0; i < data.data[key].length; i++) { 
                                    const value = data.data[key][i]
                                    console.log(value)
                                    return <CardProgramacao dateKey={key} cor_primaria={'#FF7F50'} event={value} key={Math.floor(Math.random() * 100)} />
                                }
                                */
                            }) : ""
                    }
                </div>
            </div>
        </div>
    )

}

// <CardProgramacao cor_primaria="#FFEBCD"/>
const CardProgramacaoLoading = ({cor_primaria, responsive}) => {
    //
    //
    return (
        <>
            <div className={`flex ${responsive?"hidden":"flex"} ${responsive?"lg:flex":""}`}>
                <div className="flex flex-col text-center w-[100%] space-y-3">
                    <div className={`text-white font-extrabold rounded-t-lg`} style={{'background-color':cor_primaria}}>
                        <h1 className="p-2 blur-[3px] animate-pulse">SEGUNDA 14/10</h1>
                    </div>
                    <div className="flex flex-col bg-white p-2">
                        <div className="text-start text-black text-[12px] font-semibold">
                            <p className="blur-[3px] animate-pulse">
                                Capela - IMEPAC
                            </p>
                        </div>
                        <p className={` font-semibold blur-[3px] animate-pulse`} style={{'color':cor_primaria}}>18:00</p>
                        <p className="text-black blur-[3px] animate-pulse">Abertura</p>
                    </div>
                    <div className="flex flex-col bg-white p-2">
                        <div className="text-start text-black text-[12px] font-semibold">
                            <p className="blur-[3px] animate-pulse">
                                Capela - IMEPAC
                            </p>
                        </div>
                        <p className={`font-semibold blur-[3px] animate-pulse`} style={{'color':cor_primaria}}>18:45</p>
                        <p className="text-black blur-[3px] animate-pulse">Palestra com o Fulano de Tal</p>
                    </div>
                    <div className="flex flex-col bg-white p-2">
                        <div className="text-start text-black text-[12px] font-semibold">
                            <p className="blur-[3px] animate-pulse">
                                Capela - IMEPAC
                            </p>
                        </div>
                        <p className={`font-semibold blur-[3px] animate-pulse`} style={{'color':cor_primaria}}>20:00</p>
                        <p className="text-black blur-[3px] animate-pulse">Coffe Break</p>
                    </div>
                    <div className="flex flex-col bg-white p-2">
                        <div className="text-start text-black text-[12px] font-semibold">
                            <p className="blur-[3px] animate-pulse">
                                Capela - IMEPAC
                            </p>
                        </div>
                        <p className={`font-semibold blur-[3px] animate-pulse`} style={{'color':cor_primaria}}>20:30</p>
                        <p className="text-black blur-[3px] animate-pulse">Fechamento</p>
                    </div>
                </div>
            </div>
        </>
    )
}

const CardProgramacao = ({cor_primaria, dateKey, event}) => {
    console.log(event)
    // Conversor UTC
    const conversorUTC = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
    const date = new Date(event[0].timeline[0].date_init) // pegando o primeiro.
    const diaUTC = conversorUTC[date.getUTCDay()]
    //
    //
    return (
        <>
            <div className="flex">
                <div className="flex flex-col text-center w-[100%] space-y-3">
                    <div className={`text-white font-extrabold rounded-t-lg`} style={{'background-color':cor_primaria}}>
                        <h1 className="p-2">{diaUTC+" "}{dateKey}</h1>
                    </div>
                    <div className="flex flex-col text-center w-[100%] space-y-3">
                        {
                            event.map((value1) => {
                                return value1.timeline.map((value,index)=>{
                                    const nome = value1.name
                                    return (
                                        <div key={index} className="flex flex-col w-[100%] p-2 bg-white text-black space-y-3">
                                            <div className="flex flex-col">
                                                {
                                                    index == 0 ?
                                                    <p className="text-center font-bold text-[16px]">{nome}</p> : ""
                                                }
                                            </div>
                                            <div className="flex flex-row text-center space-x-1 content-center justify-center align-middle items-center w-[100%]">
                                                <h1  className="font-semibold" style={{'color':cor_primaria}}>{new Date(value.date_init).toLocaleTimeString().slice(0,5)}</h1>
                                                <h1  className="font-semibold" style={{'color':cor_primaria}}>-</h1>
                                                <h1  className="font-semibold" style={{'color':cor_primaria}}>{new Date(value.date_end).toLocaleTimeString().slice(0,5)}</h1>
                                            </div>
                                            <div className="text-center">
                                                <h1>{value.name}</h1>
                                            </div>
                                            <div className="text-start">
                                                <p className="text-start text-[13px]">🗺{value.local}</p>
                                            </div>

                                        </div>
                                    )
                                })
                            })
                        }
                    </div>
                </div>
            </div>
        </>
    )
}

const Header = () => {
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
              <li>
                <Link href="/painel/" className='hover:text-red-500 ease-linear duration-150'>
                  Área do Congressista
                </Link>
              </li>
              <li>
              <Link href="/organizadores" className='hover:text-red-500 ease-linear duration-150'>
                  Trabalhos
                </Link>
              </li>
              <li>
                <Link href="/painel/minhaProgramacao" className='hover:text-red-500 ease-linear duration-150'>
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
              <li>
                <Link href="/painel/" className='hover:text-red-500 ease-linear duration-150'>
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