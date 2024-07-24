'use client'
import React, { useState, useEffect } from 'react';
import Waves from '@/app/components/Waves';
import { userAgentFromString } from 'next/server';
import { DateTime } from 'luxon';
//
//
const organizeByTypeAndDate = (data) => {
    const mergedData = [...data.result1, ...data.result2];

    const groupedByTypeAndDate = mergedData.reduce((acc, item) => {
        const type = item.type;
        const date = item.timeline[0].date_init.split('T')[0]; // Extracting the date part (YYYY-MM-DD)

        if (!acc[type]) {
            acc[type] = {};
        }

        if (!acc[type][date]) {
            acc[type][date] = [];
        }

        acc[type][date].push(item);

        return acc;
    }, {});

    for (const type in groupedByTypeAndDate) {
        for (const date in groupedByTypeAndDate[type]) {
            groupedByTypeAndDate[type][date].sort((a, b) => {
                const dateA = new Date(a.timeline[0].date_init);
                const dateB = new Date(b.timeline[0].date_init);
                return dateA - dateB;
            });
        }
    }

    return groupedByTypeAndDate;
};

const App = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(1)
    const [organizedData, setOrganizedData] = useState({})
    const [timeLineModal, setTimeLineModal] = useState(undefined)
    //
    const [showModal, setShowModal] = useState(false);

    const openModal = (timeline) => setShowModal(timeline);
    const closeModal = () => setShowModal(false);


    //
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/inauthenticated/get/programacao');
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
            finally {
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (data) {
            setOrganizedData(organizeData(data));
            setLoading(0)
        }
    }, [data]);


    function organizeData(data) {
        const combinedResults = [...data.result1, ...data.result2];
        const organized = {};
        combinedResults.forEach((item) => {
            if (!organized[item.type]) {
                organized[item.type] = [];
            }
            organized[item.type].push(item)
        })
        return organized
        /*
        combinedResults.forEach((item) => {
            if (!organized[item.type]) {
                organized[item.type] = {};
            }

            item.timeline.forEach((timelineItem) => {
                const date = timelineItem.date_init.split('T')[0]; // Pega somente a data
                if (!organized[item.type][date]) {
                    organized[item.type][date] = [];
                }

                organized[item.type][date].push({
                    ...timelineItem,
                    'namePattern': item.name,
                    'descriptionPattern': item.description,
                    date_init: timelineItem.date_init.split('T')[0], // Mantém apenas a data no objeto
                });
            });
        });

        // Ordenar os eventos por date_init dentro de cada data
        for (const type in organized) {
            for (const date in organized[type]) {
                organized[type][date].sort((a, b) => new Date(a.date_init) - new Date(b.date_init));
            }
        }
        */
        return organized;
    }

    /*
    
    <button onClick={() => { console.log(organizeByTypeAndDate(data)) }} className='bg-black'>aaa</button>
    <button onClick={() => { console.log(organizedData) }} className='bg-black'>bbb</button>
    <button onClick={() => { console.log(typeSelected) }} className='bg-black'>CCC</button>
    
    */

    return (
        <div className="min-h-screen ">
            <Modal show={showModal} onClose={closeModal} />

            <div className="relative bg-[url(Site.jpg)] flex content-center justify-center font-semibold text-[30px] p-36  bg-center bg-cover">
                <h1 className='font-coeps text-white'>PROGRAMAÇÃO</h1>
                <div className="absolute -bottom-1 left-0 w-full overflo z-20  text-white">
                    <Waves />
                </div>
            </div>
            <div className="flex content-center justify-center py-5">
                <div className="w-[95%] sm:w-[70%] space-y-5 py-10">
                    <h1 className="font-semibold text-slate-950 text-[25px] lg:text-[30px] font-coeps">NOSSA PROGRAMAÇÃO</h1>
                    <h1 className="text-black text-justify">
                        O V COEPS contará com uma extensão programação durante os 04 dias de eventos, sendo todas as atividades presencialmente. Teremos palestras, minicursos, atividades político culturais,
                        vivências e visita técnicas, apresentação de trabalhos, entre outras, buscando fornecer diferentes possibilidades ao aluno participante.
                        Fique ligado no site e em nossos meios de comunicação oficiais! <span className='bg-yellow-200 text-slate-950 font-bold px-1'>Selecione entre as opções para navegar em nossa programação.</span>
                    </h1>
                </div>
            </div>
            <div>
                <div className='flex flex-col justify-center bg-[#3E4095] p-5 space-y-5'>
                    <div className='text-center'>
                        <h1 className='text-white font-coeps text-[25px]'>{!loading && Object.keys(organizedData).length > 0 ? 'CLIQUE PARA OBTER MAIS DETALHES' : ""}</h1>
                        <h1 className='text-white font-coeps text-[25px]'>{!loading && Object.keys(organizedData).length == 0 ? 'AINDA NÃO TEMOS UM CRONOGRAMA DE EVENTOS' : ""}</h1>

                    </div>
                </div>
            </div>

            <div className='bg-green-100 p-5'>
                <div className='flex flex-col justify-center'>
                    <div className='flex flex-row flex-wrap justify-center space-x-6'>
                        <div className='flex flex-col justify-center content-center items-center  w-[95%] xl:w-[40%] md:w-[60%]'>
                            {
                                !loading && Object.keys(organizedData).length > 0 ? Object.keys(organizedData).map((value, index) => {
                                    //const dateTime = DateTime.fromISO(value)
                                    //const dateEvent = dateTime.toISODate().split("-").reverse().join("-")
                                    return (
                                        <div className='w-full shadow-lg drop-shadow-md' key={index}>
                                            <div className={`bg-white w-full text-center flex items-center justify-center content-center align-middle py-2 ${!index ? "rounded-t-lg" : ""}`} >
                                                <h1 className='text-slate-800 font-coeps text-center'>{value.toLocaleUpperCase()}S</h1>

                                            </div>
                                            <div className='w-full'>
                                                {
                                                    organizedData[value].map((value) => {
                                                        const color = generateHexColor()
                                                        return (
                                                            <div key={value._id} className='flex flex-row  w-full max-w-full overflow-hidden space-x-1 py-5 cursor-pointer' style={{ backgroundColor: color }}
                                                                onClick={() => {
                                                                    openModal(value)
                                                                }}
                                                            >
                                                                <div className='px-5 border-r-[1px] text-black text-[20px]'> {value.emoji} </div>
                                                                <div className='text-white flex items-start justify-center align-middle content-center'>
                                                                    <h1 className='font-bold'>{value.name}</h1>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                }
                                            </div>
                                        </div>
                                    )
                                }) : ""
                            }
                            {
                                !loading && Object.keys(organizedData).length == 0 ?
                                    <h1 className='text-black font-semibold text-center'>Mas não se preocupe! Estamos trabalhando muuuito para isso! Fique ligado nas novidades!</h1> : ""
                            }
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};


export default App;

const Modal = ({ show, onClose, event }) => {

    if (!show) {
        return null;
    }

    return (
        <div className="fixed z-50 inset-0 overflow-y-auto ">
            <div className="flex items-center justify-center min-h-screen px-4 z-[50]">

                <div className="fixed inset-0 bg-black  opacity-60 z-40" onClick={onClose}></div>
                <div className='z-[100] w-[100%] h-[600px] overflow-auto bg-white sm:w-[60%] md:w-[50%] xl:w-[40%] 2xl:w-[30%] shadow-lg drop-shadow-lg '>
                    <div className='text-center  '>
                        <div className='bg-[#3E4095] py-1' >
                            <button className='bg-yellow-600 px-2 py-1' onClick={onClose}>FECHAR</button>
                        </div>
                        <div className='bg-red-200'>
                            <h1 className='text-black font-coeps text-[15px] py-3'>{show.name.toLocaleUpperCase()}</h1>
                        </div>
                        <div className='space-y-2'>
                            <div className='bg-zinc-400 px-5'>
                                <h1 className='text-slate-950 text-start font-semibold'>SOBRE O EVENTO</h1>
                            </div>
                            <div className='px-5'>
                                <p className='text-slate-950 text-[15px] text-justify font-thin'>{show.description}</p>
                            </div>
                        </div>



                        <div className=' space-y-2 '>
                            <div className=''>
                                <div className='bg-zinc-400 px-5'>
                                    <h1 className=' text-start font-semibold text-black'>AGENDA DO EVENTO</h1>
                                </div>
                                <div className='space-y-5 px-5'>
                                    {
                                        show?.timeline?.map((value) => {
                                            const dataInicio = new Date(value.date_init)
                                            const dataFim = new Date(value.date_end)


                                            return (
                                                <div key={value._id} className='text-start space-y-2'>
                                                    <h1 className=' font-semibold text-center text-slate-900'>{value.name.toLocaleUpperCase()}</h1>
                                                    <h1 className='text-slate-900'>{value.description}</h1>
                                                    <h1 className='text-slate-900'><span className='font-emoji text-slate-900'>📍</span> {value.local} <span>{value.local_description}</span></h1>
                                                    <h1 className='text-slate-900'><span className='font-emoji text-slate-900'>🕐</span>Início - {dataInicio.toLocaleString()}</h1>
                                                    <h1 className='text-slate-900'><span className='font-emoji text-slate-900'>🕐</span>Fim - {dataFim.toLocaleString()}</h1>

                                                </div>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
const Waves2 = () => {
    return (
        <div className="relative w-full overflow-hidden h-[15vh] min-h-[100px] max-h-[150px]">
            <svg
                className="absolute w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 24 150 28"
                preserveAspectRatio="none"
                shapeRendering="auto"
            >
                <defs>
                    <path
                        id="gentle-wave"
                        d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
                    />
                </defs>
                <g className="parallax">
                    <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(62, 64, 149,0.7)" />
                    <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(62, 64, 149,0.5)" />
                    <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(62, 64, 149,0.3)" />
                    <use xlinkHref="#gentle-wave" x="48" y="7" fill="#3e4095" />
                </g>
            </svg>
        </div>
    );
};
function generateHexColor() {
    let color;
    do {
        color = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    } while (isTooCloseToWhite(color));
    return `#${color}`;
}

function isTooCloseToWhite(hex) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Verifica se a cor é muito clara (próxima do branco)
    return (r > 200 && g > 200 && b > 200);
}


/*

            <div className="bg-[url(Site.jpg)] flex content-center justify-center font-semibold text-[30px] p-16  bg-center bg-cover">
                <h1>Programação</h1>
            </div>
            <div className="flex content-center justify-center py-5">
                <div className="w-[95%] sm:w-[70%] space-y-5">
                    <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]">Nossa Programação</h1>
                    <h1 className="text-black text-justify">
                        O V COEPS contará com uma extensão programação durante os 04 dias de eventos, sendo todas as atividades presencialmente. Teremos palestras, minicursos, atividades político culturais,
                        vivências e visita técnicas, apresentação de trabalhos, entre outras, buscando fornecer diferentes possibilidades ao aluno participante.
                        Fique ligado no site e em nossos meios de comunicação oficiais! <span className='bg-yellow-200 text-slate-950 font-bold px-1'>Selecione entre as opções para navegar em nossa programação.</span>
                    </h1>
                </div>
            </div>
            <div className="flex content-center justify-center py-2">
                <div className="flex flex-col justify-center items-center w-[95%] sm:w-[70%]">
                    {loading ?
                        <h1 className='p-1 text-white font-bold bg-red-500 shadow-md drop-shadow-md'>CARREGANDO</h1>
                        : ""
                    }
                    <div className="flex flex-wrap content-center items-center align-middle justify-center gap-3">
                        {data && Object.keys(organizeByTypeAndDate(data)).map(type => (
                            <div className='' key={type}>
                                <button
                                    onClick={() => handleTypeClick(type)}
                                    className={`flex flex-col justify-center items-center font-bold p-1 shadow-md drop-shadow-md text-[15px] duration-700 ${selectedType === type ? 'bg-red-800 text-white' : 'bg-red-500 text-white '}`}
                                >
                                    {type.toLocaleUpperCase()}
                                    <div className={`py-[0.1px]  w-[50%] ${selectedType == type ? 'bg-white' : ""}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {availableDates.length > 0 && (
                <div className="flex content-center justify-center ">
                    <div className="w-[95%] sm:w-[70%] space-y-5 ">
                        <div className="flex flex-wrap gap-2 content-center justify-center space-x-1">
                            {availableDates.map((date, index) => (
                                <div className='flex flex-col justify-center items-center' key={index}>
                                    <button
                                        key={date}
                                        onClick={() => handleDateClick(date)}
                                        className={`text-[13px] font-bold ${selectedDate === date ? 'text-red-600 ' : 'text-[#3E4095]'}`}
                                    >
                                        {date.split("-").reverse().join('-')}
                                    </button>
                                    <div className={`py-[0.1px]  w-[50%] ${selectedDate == date ? 'bg-red-600' : ""}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}



            <div className='flex flex-row content-center justify-center bg-[#3E4095] py-5'>
                <div className=' w-[95%] md:w-[40%]'>
                    <div className='text-center font-bold p-2'>
                        <h1>{selectedType ? "CRIE UMA CONTA PARA OBTER MAIS DETALHES" : "SELECIONE UMA DAS OPÇÕES ACIMA"}</h1>
                    </div>
                    {events.length > 0 ? (
                        <>
                            <ul className='flex flex-col justify-center items-center'>
                                {events.map(event => (
                                    <li key={event._id} className="mb-4 p-4 border rounded cursor-pointer bg-slate-50 text-black w-[100%] space-y-2">
                                        <h2 className="text-xl font-bold font-sans text-[13px]">{event.name.toLocaleUpperCase()}</h2>
                                        <p>{event.description}</p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : ""
                    }
                    {
                        events?.length == 0 ??
                        <h1 className='bg-black text-center'>Nenhum evento encontrado</h1>
                    }
                </div>
            </div>



*/