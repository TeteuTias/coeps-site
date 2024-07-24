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
          cache: 'no-cache',
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
        // (responseData)
        // console.log("| ============================== |") 
        handleData({ "data": organizeData(responseData) })
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
    <div className="bg-[#3E4095] min-h-dvh">
      {
        modal ? <Modal handleModal={() => { handleModal(0) }} modal={modal} /> : ""
      }
      <div className="flex flex-col content-center align-middle items-center justify-center">
        <div className="bg-[#3E4095] w-full text-center flex items-center justify-center">
          <div className="w-[90%] lg:w-[60%] text-justify p-5">
            <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Minha Programação</h1>
          </div>
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
      </div>
      <div className="flex flex-col justify-center items-center bg-[#3E4095] p-5">
        <div className="flex flex-col relative w-[90%] lg:w-[40%]">
          {
            isFetching ?
              (<>
                <CardProgramacaoLoading responsive={0} cor_primaria={"#FF7F50"} />
              </>) : ""
          }
        </div>
        <div className=" space-y-10  w-[95%] lg:w-[45%]">
          {
            !isFetching && data?.data ?
              Object.keys(data.data).map(key => {
                // key - 2024-07-16
                // console.log(key)
                const hexColor = generateRandomHexColor()
                return <CardProgramacao dateKey={key} cor_primaria={hexColor} event={data.data[key]} key={Math.floor(Math.random() * 100)} handleModal={handleModal} />
              }) : ""
          }
          {
            !isFetching && (!data.data || data.data.length == 0) ?
              <div>
                <h1 className="break-words text-center font-bold text-white text-[22px] lg:text-[18px]">Ainda não há uma programação</h1>
              </div>

              : ""
          }
        </div>
      </div>
    </div>

  )

}
//
/*

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

*/
function organizeData(data) {
  const organized = {};
  data['palestras'].map((value1, index) => {
    value1.timeline.map((value2) => {
      // NAME description
      value2.namePattern = value1.name
      value2.descriptionPattern = value1.description,
        value2.organization_namePattern = value1.organization_name,
        value2.timelinePattern = value1.timeline
    })
  })
  data['minicursos'].map((value1, index) => {
    value1.timeline.map((value2) => {
      // NAME description
      value2.namePattern = value1.name
      value2.descriptionPattern = value1.description,
        value2.organization_namePattern = value1.organization_name,
        value2.timelinePattern = value1.timeline
    })
  })


  //console.log(data)
  // Combine todos os eventos das listas, verificando se as listas existem e são arrays
  const allEvents = [
    ...(Array.isArray(data.minicursos) ? data.minicursos.flatMap(item => item.timeline || []) : []),
    ...(Array.isArray(data.palestras) ? data.palestras.flatMap(item => item.timeline || []) : []),
  ];

  // Organize os eventos por data
  allEvents.forEach(event => {
    const date = event.date_init.split('T')[0]; // Pega somente a data
    if (!organized[date]) {
      organized[date] = [];
    }

    organized[date].push({
      ...event,
      date_init: event.date_init//.split('T')[0], // Mantém apenas a data no objeto
    });
  });
  // Ordenar os eventos por data e por data/hora
  Object.keys(organized).forEach(date => {
    // organized[date].sort((a, b) => new Date(a.date_init + 'T' + a.date_init.split('T')[1]) - new Date(b.date_init + 'T' + b.date_init.split('T')[1]));
    organized[date].sort((a, b) => new Date(a.date_init) - new Date(b.date_init));

  });

  return organized;
}

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

  /*
  
  
  return (
    <h1>Sou um modal</h1>
  )
  
  */
  // const timeline = organizeTimelineByDate(modal.timeline)
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
            <h1 className="break-words text-center font-extrabold text-black text-[15px] lg:text-[16px]">{modal.namePattern.toLocaleUpperCase()}</h1>
          </div>
          <div className="text-zinc-700 space-y-2">
            <h1 className="font-bold bg-amber-200">ℹ SOBRE</h1>
            <p className="text-justify font-extralight">
              {modal.descriptionPattern}
            </p>
          </div>
          <div className="text-zinc-700 space-y-2">
            <h1 className="font-bold bg-amber-200">📅 PROGRAMAÇÃO</h1>
            <div className="space-y-6">
              {
                modal.timelinePattern.map(event => {

                  const data = new Date(event.date_init).toLocaleDateString()
                  const time_init = new Date(event.date_init).toLocaleTimeString()
                  const time_end = new Date(event.date_end).toLocaleTimeString()
                  return (
                    <div className="space-y-3" key={Math.floor(Math.random() * 100)}>
                      <div>
                        <div className="flex flex-row space-x-2">
                          <p className="font-emoji">◽</p>
                          <p>{event.name.toLocaleUpperCase()}</p>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex flex-row space-x-2">
                            <h1 className="font-emoji">🕐</h1>
                            <h1>{data.slice(0, 5)}</h1>
                            <h1>-</h1>
                            <h1>{time_init.slice(0, 5)} às {time_end.slice(0, 5)}</h1>
                          </div>
                          <div className="flex flex-row space-x-2">
                            <h1 className="font-emoji">📍 {event.local}</h1>
                            <h1>{event.local_description}</h1>
                          </div>
                          <div className="flex flex-row space-x-2">
                            <h1 className="font-emoji">⭐</h1>
                            <h1>{event.description}</h1>
                          </div>
                        </div>
                      </div>
                      <div className="bg-zinc-700 p-[0.05px] w-[60%]" />
                    </div>
                  )
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
            <div className={`text-white font-extrabold rounded-t-lg p-1 animate-pulse blur-[0.5px]`} />
          </div>
        </div>

      </div>
    </>
  )
}

function padZeroIfNeeded(number) {
  return number < 10 ? '0' + number : number.toString();
}

const CardProgramacao = ({ cor_primaria, dateKey, event, handleModal }) => {
  const DATE = new Date(dateKey + "T13:30:00-03:00")
  const daysNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const dayName = daysNames[DATE.getDay()]
  const dayMouth = `${padZeroIfNeeded(DATE.getDate())}/${padZeroIfNeeded(DATE.getMonth())}`
  return (
    <>
      <div className={`flex`} onClick={() => { }}>
        <div className="flex flex-col text-center w-[100%] space-y-3">
          <div className={`text-white font-extrabold rounded-t-lg`}>
            <h1 className="text-start">{dayMouth.toLocaleUpperCase() + " "}{dayName}</h1>
            <div className={`text-white font-extrabold rounded-t-[0.1px] p-1`} />
          </div>
          <div className="space-y-2">
            {
              event?.map((value, index) => {
                const dateInit = new Date(value.date_init).toLocaleTimeString()
                const dateEnd = new Date(value.date_end).toLocaleTimeString()
                //const date_init = new Date(value.timeline[0].date_init).toLocaleTimeString().slice(0, 5)
                //const date_end = new Date(value.timeline[value.timeline.length - 1].date_end).toLocaleTimeString().slice(0, 5)

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
                      <div className={`flex-1 flex-col content-center items-center justify-center align-middle w-[20%] border-l-2 text-black`}>
                        <p>{dateInit}</p>
                        <p>às</p>
                        <p>{dateEnd}</p>
                      </div>
                    </div>
                    <div className="flex flex-row text-start text-[13px] p-2 lg:p-3 text-zinc-700">
                      <p className="px-2 font-emoji">👩‍🎓</p>
                      <p className="px-2">{value.namePattern.toLocaleUpperCase()}</p>
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
            <div className={`text-white font-extrabold rounded-t-[0.1px] p-1`} />
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
                      <div className={`flex-1 flex-col content-center items-center justify-center align-middle w-[20%] border-l-2 text-black`}>
                        <p>{date_init}</p>
                        <p>às</p>
                        <p>{date_end}</p>
                      </div>
                    </div>
                    <div className="flex flex-row text-start text-[13px] p-2 lg:p-3 text-zinc-700">
                      <p className="px-2">📍</p>
                      <p className="px-2">CLIQUE PARA MAIS INFORMAÇÕES</p>
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
*/