'use client'
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
//
//
//
export default function MinhaProgramacao() {
  const [isFetching, setIsFetching] = useState(1)
  const [data, setData] = useState(undefined)
  const [modal, setModal] = useState(undefined)
  //
  //
  const handleModal = (event) => {
    setModal(event)
  }
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

    return Object.keys(organizedEvents).length ? organizedEvents : undefined;
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
        handleData({ "data": organizeEventsByDate(responseData) })
      } catch (error) {
        console.error('Erro ao enviar a requisição GET:', error);

        // Tratar erros conforme necessário
      }
    };
    enviarRequisicaoGet();
  }, []);
  //
  //
  return (
    <>
      <div className=" min-h-screen pb-10 bg-[#3E4095]">
        {
          modal ? <Modal handleModal={() => { handleModal(0) }} modal={modal} /> : ""
        }
        <div className="flex flex-col content-center align-middle items-center justify-center ">
          <div className="w-[90%] lg:w-[60%] text-justify p-5 ">
            <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Minha Programação</h1>
          </div>
          <div className="flex justify-center w-full bg-white">
            <div className="w-[90%] lg:w-[50%] text-gray-700 text-clip py-16">
              <h1 className="break-words text-start font-bold text-black text-[22px] lg:text-[18px]">O QUE TEMOS AQUI</h1>
              <h1 className="text-justify">Aqui está o seu cronograma de eventos! Todos os eventos obrigatórios e aqueles em que você se inscreveu estão organizados para que você
                não fique perdido. Não se esqueça de se inscrever nos minicursos! Clicando nos cards, você consegue mais informações sobre o evento presente
                na sua agenda.
              </h1>
            </div>
          </div>
          <div className="flex flex-col relative w-[90%] lg:w-[40%] mt-6">
            {
              isFetching ?
                (<>
                  <CardProgramacaoLoading responsive={0} cor_primaria={"#FF7F50"} />
                </>) : ""
            }
            <div className=" space-y-10">
              {
                !isFetching && data.data ?
                  Object.keys(data.data).map(key => {
                    // key - 2024-07-16
                    const hexColor = generateRandomHexColor()
                    return <CardProgramacao dateKey={key} cor_primaria={hexColor} event={data.data[key]} key={Math.floor(Math.random() * 100)} handleModal={handleModal} />
                  }) : ""
              }
            </div>
          </div>
        </div>
      </div>
    </>

  )

}
//
const organizeTimelineByDate = (timeline) => {
  const organized = {};

  timeline.forEach(event => {
    const dateInit = new Date(event.date_init);
    const dateStr = dateInit.toISOString().split('T')[0];

    if (!organized[dateStr]) {
      organized[dateStr] = [];
    }

    organized[dateStr].push(event);
  });

  // Ordenar os eventos por horário de início
  Object.keys(organized).forEach(date => {
    organized[date].sort((a, b) => new Date(a.date_init) - new Date(b.date_init));
  });

  return organized;
};
const Modal = ({ handleModal, modal }) => {
  console.log("================")
  console.log(organizeTimelineByDate(modal.timeline))
  const timeline = organizeTimelineByDate(modal.timeline)
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black opacity-50" onClick={handleModal}></div>
      <div className="bg-white rounded-lg shadow-lg w-[95%] lg:w-[45%] max-h-[80vh] overflow-y-auto z-10 p-3 lg:p-10 ">
        <div className="text-white">
          <button className="bg-red-600 hover:text-gray-700 float-right w-7 h-7 rounded-full" onClick={handleModal}>
            &#x2715;
          </button>
        </div>
        <div className="space-y-5">
          <div>
            <h1 className="break-words text-center font-extrabold text-black text-[15px] lg:text-[16px]">{modal.name.toLocaleUpperCase()}</h1>
          </div>
          <div className="text-zinc-700 space-y-2">
            <h1 className="font-bold bg-amber-200">ℹ SOBRE</h1>
            <p className="text-justify font-extralight">
              {modal.description}
            </p>
          </div>
          <div className="text-zinc-700 space-y-2">
            <h1 className="font-bold bg-amber-200">📅 PROGRAMAÇÃO</h1>
            <div className="space-y-6">
              {
                Object.keys(timeline).map(date => {
                  console.log(`Eventos em ${date}:`);
                  return timeline[date].map(event => {
                    console.log(`Nome: ${event.name}`);
                    console.log(`Descrição: ${event.description}`);
                    console.log(`Início: ${event.date_init}`);
                    console.log(`Fim: ${event.date_end}`);
                    console.log('---');


                    const data = new Date(event.date_init).toLocaleDateString()
                    const time_init = new Date(event.date_init).toLocaleTimeString()
                    const time_end = new Date(event.date_end).toLocaleTimeString()

                    return (
                      <div className="space-y-3" key={Math.floor(Math.random() * 100)}>
                        <div>
                          <div className="flex flex-row space-x-2">
                            <p>◽</p>
                            <p>{event.name.toLocaleUpperCase()}</p>
                          </div>
                          <div className="flex flex-col">
                            <div className="flex flex-row space-x-2">
                              <h1>🕐</h1>
                              <h1>{data.slice(0, 5)}</h1>
                              <h1>-</h1>
                              <h1>{time_init.slice(0, 5)} às {time_end.slice(0, 5)}</h1>
                            </div>
                            <div className="flex flex-row space-x-2">
                              <h1>📍 {event.local}</h1>
                              <h1>{event.local_description}</h1>
                            </div>
                            <div className="flex flex-row space-x-2">
                              <h1>⭐</h1>
                              <h1>{event.description}</h1>
                            </div>
                          </div>
                        </div>
                        <div className="bg-zinc-700 p-[0.05px] w-[60%]" />
                      </div>
                    )
                  });
                })

              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
//
function generateRandomHexColor() {

  // Define os valores mínimo e máximo para as componentes RGB
  const min = 120; // mínimo para garantir que não sejam muito escuras
  const max = 255; // máximo para garantir que possam ser muito claras

  // Gera valores aleatórios para as componentes RGB dentro da faixa [min, max]
  const r = Math.floor(Math.random() * (max - min + 1) + min);
  const g = Math.floor(Math.random() * (max - min + 1) + min);
  const b = Math.floor(Math.random() * (max - min + 1) + min);

  // Converte as componentes RGB para uma string hexadecimal
  const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  return hexColor;
}
// <CardProgramacao cor_primaria="#FFEBCD"/>
const CardProgramacaoLoading = ({ cor_primaria, responsive }) => {
  //
  //
  return (
    <>
      <div className={`flex flex-col`}>
        <div className="flex flex-col text-center w-[100%] space-y-3">
          <div className={`text-white font-extrabold rounded-t-lg `}>
            <h1 className="text-start">CARREGANDO</h1>
            <div className={`text-white font-extrabold rounded-t-lg p-1 animate-pulse blur-[0.5px]`} style={{ 'backgroundColor': cor_primaria }} />
          </div>
        </div>

      </div>
    </>
  )
}

const CardProgramacao = ({ cor_primaria, dateKey, event, handleModal }) => {
  console.log(event)
  // Conversor UTC
  const conversorUTC = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const date = new Date(event[0].timeline[0].date_init) // pegando o primeiro.
  const diaUTC = conversorUTC[date.getUTCDay()]
  const dia_ano = new Date(event[0].timeline[0].date_init).toLocaleDateString().slice(0, 5)
  //
  //
  return (
    <>
      <div className={`flex`}>
        <div className="flex flex-col text-center w-[100%] space-y-3">
          <div className={`text-white font-extrabold rounded-t-lg`}>
            <h1 className="text-start">{diaUTC.toLocaleUpperCase() + " "}{dia_ano}</h1>
            <div className={`text-white font-extrabold rounded-t-[0.1px] p-1`} style={{ 'backgroundColor': cor_primaria }} />
          </div>
          <div className="space-y-2">
            {
              event.map((value, index) => {
                const date_init = new Date(value.timeline[0].date_init).toLocaleTimeString().slice(0, 5)
                const date_end = new Date(value.timeline[value.timeline.length - 1].date_end).toLocaleTimeString().slice(0, 5)

                return (
                  <div className="flex flex-col bg-white cursor-pointer" onClick={() => { handleModal(value) }} key={index}>
                    <div className=" flex flex-row p-2 lg:p-3">
                      <div className="w-[80%] text-start px-2">
                        <div>
                          <h1 className="break-words text-start font-extrabold text-black text-[13px] lg:text-[16px]">{value.name.toLocaleUpperCase()}</h1>
                        </div>
                        <div>
                          <p className="text-zinc-700 font-extralight">{value.description}</p>
                        </div>
                      </div>
                      <div className={`flex-1 flex-col content-center items-center justify-center align-middle w-[20%] border-l-2 text-black`} style={{ borderColor: cor_primaria }}>
                        <p>{date_init}</p>
                        <p>às</p>
                        <p>{date_end}</p>
                      </div>
                    </div>
                    <div className="flex flex-row text-start text-[13px] p-2 lg:p-3 text-zinc-700">
                      <p1 className="px-2">📍</p1>
                      <p1 className="px-2">CLIQUE PARA MAIS INFORMAÇÕES</p1>
                    </div>
                  </div>

                )
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