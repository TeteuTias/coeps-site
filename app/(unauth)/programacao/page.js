'use client'
import React, { useState, useEffect } from 'react';

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
    const [selectedType, setSelectedType] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(1)

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
            const organizedData = organizeData(data);
            if (selectedType && selectedDate) {
                setEvents(organizedData[selectedType][selectedDate] || []);
            }
            setLoading(0)
        }
    }, [data, selectedType, selectedDate]);

    useEffect(() => {
        if (selectedType && selectedDate && data) {
            const organizedData = organizeData(data);
            setEvents(organizedData[selectedType][selectedDate] || []);
        }
    }, [selectedType, selectedDate, data]);

    const handleTypeClick = (type) => {
        setSelectedType(type);
        if (data) {
            const dates = Object.keys(organizeData(data)[type] || {});
            setAvailableDates(dates);
            setSelectedDate(dates.length > 0 ? dates[0] : '');
        }
    };

    const handleDateClick = (date) => {
        setSelectedDate(date);
    };

    function organizeData(data) {
        const combinedResults = [...data.result1, ...data.result2];
        const organized = {};

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
                    'namePattern':item.name,
                    'descriptionPattern':item.description,
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

        return organized;
    }



    return (
        <div className="min-h-screen space-y-2">
            <button className='bg-black' onClick={() => {
                console.log(organizeData(data))
            }}>AA</button>
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
                                {
                                    events.map((event) => {
                                        //const tittlePattern = data.map(())
                                        return (
                                            <li key={event._id} className="mb-4 p-4 border rounded cursor-pointer bg-slate-50 text-black w-[100%] space-y-2">
                                                <h1>{event.namePattern}</h1>
                                                <h2 className="text-xl font-bold font-sans text-[13px]">{event.name.toLocaleUpperCase()}</h2>
                                                <p>{event.description}</p>
                                            </li>
                                        )
                                    }
                                    )
                                }
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

        </div>
    );
};


export default App;

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