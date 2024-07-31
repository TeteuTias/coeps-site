'use client'
import { useEffect, useState } from "react"
import HeaderPainel from "@/app/components/HeaderPainel"
import WarningModal from "@/app/components/WarningModal"
import { DateTime } from "luxon"
import { useRouter } from 'next/navigation';
import Link from "next/link"
//
//
//
export default function Minicursos() {
    const [loadingData, setLoadingData] = useState(1)
    const [data, setData] = useState({ _id: undefined, listEvents: [] })

    //
    //
    useEffect(() => {
        const fetchData = async () => {
            try {

                const response = await fetch('/api/get/atividades', { cache: 'no-cache' })
                const jsonResponse = await response.json()
                if (!response.ok) {
                    console.log(jsonResponse)
                    return 0
                }
                setData(jsonResponse)
            }
            catch (error) {
                console.log(error)
            }
            finally {
                setLoadingData(0)
            }
        }
        if (loadingData) {
            fetchData()
        }
    }, [loadingData])
    /*
    const handleAlreadIinscrivy = (number) => {
        return
    }
    */
    /*
     const handleAlreadyInscribed = () => {
         setData((prev) => {
             const number = !prev.alreadIinscrivy ? 0 : prev.alreadIinscrivy - 1
             return {
                 ...prev,
                 alreadIinscrivy: number
             };
         });
     }
    */
    /*
     const handleUninscribed = () => {
         setData((prev) => {
             const number = prev.alreadIinscrivy >= 3 ? 3 : prev.alreadIinscrivy + 1
             return {
                 ...prev,
                 alreadIinscrivy: number
             };
         });
     }
    */
    return (
        <div className="bg-[#3E4095] min-h-screen">
            <div className=" w-full text-center flex items-center justify-center">
                <div className="w-[90%] lg:w-[60%] text-justify p-5">
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Atividades</h1>
                </div>
            </div>
            <div className="flex content-center justify-center w-full text-gray-700 text-clip py-16 bg-white">
                <div className="w-[95%] md:w-[50%]">
                    <h1 className="break-words text-start font-bold text-black text-[22px] lg:text-[18px]">O QUE TEMOS AQUI</h1>
                    <h1 className="text-justify">
                        Aqui, você pode se inscrever em <span className="bg-yellow-300 px-1 font-bold">atividades complementares</span>. É obrigatório que cada participante escolha <span className="font-bold">três</span> dessas atividades. Lembre-se de que cada uma possui um número máximo de participantes, portanto, programe-se para se inscrever a tempo! Não se preocupe, todas as informações necessárias estão disponíveis aqui. Após a inscrição, a atividade será adicionada automaticamente à <span className="bg-yellow-300 px-1 font-bold">Minha Programação</span>. Você consegue ver mais detalhes
                        sobre as atividades <Link prefetch={false} target="_blank" href="/programacao"><span className="bg-yellow-300 px-1 cursor-pointer font-bold">clicando aqui</span></Link>.
                    </h1>
                </div>
            </div>
            <div className="flex content-center justify-center w-full text-white text-clip py-16">
                <div className="w-[95%] md:w-[50%]">
                    <h1 className="break-words text-start font-bold text-white text-[22px] lg:text-[18px]">PRECISO PAGAR?</h1>
                    <h1 className="text-justify">
                        Grande parte das atividades é <span className="bg-yellow-300 text-gray-800 font-bold px-1">gratuita</span>. Entretanto, algumas podem ter cobranças simbólicas para viabilizar
                        o evento.  Atividades pagas estão marcadas com <span className="bg-yellow-300 text-gray-800 font-bold px-1 font-emoji">💲</span>.
                    </h1>
                </div>
            </div>
            <div className="flex content-center justify-center w-full text-gray-700 text-clip py-16 bg-white">
                <div className="flex flex-col w-[95%] md:w-[50%] space-y-10">
                    <div>
                        <h1 className="break-words text-start font-bold text-black text-[22px] lg:text-[18px]">QUANTAS ATIVIDADES EU POSSO ME INSCREVER?</h1>
                        <div className="flex flex-row space-x-1">
                            <h1 className="text-justify">
                                Você pode se inscrever em <span className="bg-yellow-300 text-gray-800 font-bold px-1">quantas atividades quiser</span>. Caso queira retirar sua inscrição de algum dos eventos, basta
                                clicar no botão <span className="font-extrabold">X</span> presente no canto superior direito dos eventos que você está inscrito. Caso queria retirar sua inscrição de um evento pago, por favor entre em contato com a organização.
                            </h1>
                        </div>
                    </div>
                    <div>
                        <h1 className="break-words text-start font-bold text-black text-[22px] lg:text-[18px]">REGRAS DE INSCRIÇÃO</h1>
                        <div className="flex flex-col space-y-5">
                            <h1 className="text-justify">
                                <span className="font-emoji text-gray-800">◽</span> O congressista deve se inscrever <span className="font-bold hover:cursor-pointer">obrigatoriamente</span> em 3 atividades.
                            </h1>
                            <h1 className="text-justify">
                                <span className="font-emoji text-gray-800">◽</span><span className="font-bold">NÃO</span> são permitidas inscrições em atividades com horários conflitantes. É de responsabilidade do congressista realizar um planejamento prévio antes da abertura das inscrições.
                            </h1>
                            <h1 className="text-justify">
                                <span className="font-emoji text-gray-800">◽</span> O congressista tem acesso às datas de abertura das inscrições, horários, localizações e datas de realização das atividades <span className="font-bold hover:cursor-pointer"><Link href="/programacao" prefetch={false} target="_blank">CLICANDO AQUI</Link></span>.
                            </h1>
                        </div>
                    </div>
                </div>

            </div>
            <div className="bg-[#3e4095]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" fill="#FFFFFF" >
                    <path className="" d="M761.9,44.1L643.1,27.2L333.8,98L0,3.8V0l1000,0v3.9"></path>
                </svg>
            </div>
            <div className="flex content-center justify-center w-full text-gray-700 text-clip py-16 ">
                <div className="flex flex-col w-[95%] md:w-[70%]">
                    <div className="text-center">
                        <h1 className="break-words font-bold text-white text-[22px] lg:text-[18px]">
                            {
                                loadingData ? 'CARREGANDO ATIVIDADES' : ""
                            }
                            {
                                !loadingData && data?.listEvents.length == 0 ? "AINDA NÃO HÁ ATIVIDADES DISPONÍVEIS" : ""
                            }
                        </h1>
                        <h1 className="break-words font-bold text-white text-[22px] lg:text-[18px]">
                            {!loadingData && data?.listEvents.length > 0 ?
                                `ATIVIDADES DISPONÍVEIS`
                                : ""
                            }
                        </h1>
                    </div>

                    <div className="flex items-center content-center justify-center">
                        {
                            !loadingData && data?.listEvents.length > 0 &&
                            <div className="w-[90%] sm:w-[65%] 2xl:w-[90%] grid grid-cols-1 gap-x-10 gap-y-10 p-4 2xl:grid-cols-3 2xl:gap-2 2xl:gap-x-10 2xl:gap-y-10 lg:grid-cols-2 lg:gap-2 lg:gap-x-10 lg:gap-y-10 ">
                                {
                                    data?.listEvents.map((value) => {

                                        return (
                                            <div key={value._id}>
                                                <BannerAtividade activity={value} color={generateHexColor()} userId={data._id} />
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}
const isDateEqualOrAfterToday = (inputDate, participants, maxParticipants) => {
    // Define a data atual no fuso horário -03:00 (America/Sao_Paulo)
    const currentDate = DateTime.now().setZone('America/Sao_Paulo');

    // Converte a string de data fornecida para um objeto DateTime no mesmo fuso horário
    const inputDateTime = DateTime.fromISO(inputDate, { zone: 'America/Sao_Paulo' });

    // Compara as duas datas
    if (!maxParticipants) {
        return 'CHEIO'
    }

    if (participants >= maxParticipants) {
        return 'CHEIO'
    }

    if (currentDate < inputDateTime) {
        return "FECHADO"
    }
    return 'INSCREVER'
}
function generateHexColor() {
    const targetColor = [0x3e, 0x40, 0x95]; // RGB values of #3e4095
    const threshold = 100; // Threshold to avoid colors too close to #3e4095
    const whiteThreshold = 200; // Avoid colors too close to white

    function getRandomHex() {
        return Math.floor(Math.random() * 256);
    }

    function getHexCode(value) {
        return value.toString(16).padStart(2, '0');
    }

    function isStrongColor(red, green, blue) {
        return red > 128 || green > 128 || blue > 128;
    }

    function isCloseToWhite(red, green, blue) {
        return red > whiteThreshold && green > whiteThreshold && blue > whiteThreshold;
    }

    let color;
    do {
        let red, green, blue;

        do {
            red = getRandomHex();
            green = getRandomHex();
            blue = getRandomHex();
        } while (!isStrongColor(red, green, blue) || isCloseToWhite(red, green, blue));

        const distance = Math.sqrt(
            Math.pow(targetColor[0] - red, 2) +
            Math.pow(targetColor[1] - green, 2) +
            Math.pow(targetColor[2] - blue, 2)
        );

        if (distance > threshold) {
            color = `#${getHexCode(red)}${getHexCode(green)}${getHexCode(blue)}`;
        }
    } while (!color);

    return color;
}

const BannerAtividade = ({ activity, userId, color }) => {
    /*
    name
    emoji
    description
    isOpen
    dateOpen
    isFree
    _id
    participants
    */
    const [buttonText, setButtonText] = useState(isDateEqualOrAfterToday(activity.dateOpen, activity.participants.length, activity.maxParticipants))
    const [includesUser, setIncludesUser] = useState(activity.participants.includes(userId))
    const [modalMessage, setModalMessage] = useState(0)
    const [modalMessage3, setModalMessage3] = useState(0)
    const [modalMessage2, setModalMessage2] = useState(0)
    const [modal3Link, setModal3Link] = useState("/pagamentos")
    const [loadingModal, setLoadingModal] = useState(0)
    const nVagas = activity.maxParticipants - activity.participants.length < 0 ? "0" : activity.maxParticipants - activity.participants.length
    // const buttonText = isDateEqualOrAfterToday(activity.dateOpen)
    const handleRegister = async (eventId) => {
        setLoadingModal(1)
        try {
            switch (true) {
                case (includesUser):
                    setModalMessage("Você já está inscrito no evento!")
                    return 0
                case (buttonText == 'CHEIO'):
                    setModalMessage("Infelizmente, as vagas se esgotaram.")
                    return 0
                case (buttonText == 'INSCRITO'):
                    setModalMessage("Você já está inscrito no evento!")
                    return 0
                case (buttonText == "FECHADO"):
                    setModalMessage("Infelizmente, o evento está fechado. Não é mais possível se inscrever.")
                    return 0
                case (!activity.isOpen):
                    setModalMessage("Infelizmente, o evento está fechado. Não é mais possível se inscrever.")
                    return 0
            }
            const response = await fetch('/api/put/inscreverAtividade', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ eventId }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.log("!ok")
                console.log(result)
                if (response.status == 403) {
                    setButtonText('CHEIO')
                    setModalMessage(result.message)
                    return 0
                }
                if (response.status == 500) {
                    setModalMessage2(result.message)

                }
                setModalMessage(result.message)
                throw new Error(result.message || 'Algo ocorreu errado. Tente novamente.');
            }
            // handleAlreadyInscribed()
            setIncludesUser(1)
            setModalMessage(result.message)
            setButtonText('INSCRITO')
        } catch (error) {
            console.log(error.message);
        } finally {
            setLoadingModal(0)
        }
    };
    const handlePayedRegister = async (eventId) => {
        setLoadingModal(1)
        try {
            switch (true) {
                case (includesUser):
                    setModalMessage("Você já está inscrito no evento!")
                    return 0
                case (buttonText == 'CHEIO'):
                    setModalMessage("Infelizmente, as vagas se esgotaram.")
                    return 0
                case (buttonText == 'INSCRITO'):
                    setModalMessage("Você já está inscrito no evento!")
                    return 0
                case (buttonText == "FECHADO"):
                    setModalMessage("Infelizmente, o evento está fechado. Não é mais possível se inscrever.")
                    return 0
                case (!activity.isOpen):
                    setModalMessage("Infelizmente, o evento está fechado. Não é mais possível se inscrever.")
                    return 0
            }
            const response = await fetch('/api/payment/createActivityPayment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ eventId }),
            });

            const result = await response.json();

            if (!response.ok) {
                //console.log("!ok")
                console.log(result)
                if (response.status == 403) {
                    setButtonText('CHEIO')
                    setModalMessage(result.message)
                    return 0
                }
                if (response.status == 500) {
                    setModalMessage2(result.message)

                }
                setModalMessage(result.message)
                throw new Error(result.message || 'Algo ocorreu errado. Tente novamente.');
            }
            // handleAlreadyInscribed()
            setIncludesUser(1)
            setModalMessage3(result.message)
            setModal3Link(result.link || "/pagamentos")
            setButtonText('INSCRITO')
        } catch (error) {
            console.log(error.message);
        } finally {
            setLoadingModal(0)
        }
    };
    const handleRemoveRegister = async (eventId) => {
        setLoadingModal(1)

        switch (true) {
            case (!includesUser):
                setModalMessage("Você não está inscrito no evento, portanto, não é possível retirar sua inscrição.")
                return 0
        }

        try {
            const response = await fetch('/api/delete/desinscreverAtividade', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ eventId }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.log(result)
                if (response.status == 403) {
                    // setButtonText('CHEIO')
                    setModalMessage(result.message)
                    return 0
                }
                setModalMessage(result.message)
                throw new Error(result.message || 'Algo ocorreu errado. Tente novamente.');
            }
            //
            /*
            handleUninscribed()
            setIncludesUser(0)
            setButtonText('INSCREVER')
            */
            setModalMessage2(result.message)
        } catch (error) {
            console.log(error.message);
        } finally {
            setLoadingModal(0)
        }
    };
    return (
        <div className="relative bg-white min-h-[600px] max-h-[600px] shadow-2xl">
            <WarningModal message={modalMessage} textButton={"FECHAR"} closeModal={() => { setModalMessage(0) }} isModal={modalMessage} />
            <WarningModal message={modalMessage2} textButton={"RECARREGAR PÁGINA"} closeModal={() => { setModalMessage(0) }} isModal={modalMessage2} onClose={() => { window.location.reload() }} />
            <WarningModalPayment href={modal3Link} message={modalMessage3} textButton={"FECHAR"} closeModal={() => { setModalMessage3(0) }} isModal={modalMessage3} />
            <LoadingModal isLoading={loadingModal} />

            {
                !activity.isFree ?
                    <div className="absolute  w-fit p-2" style={{ 'backgroundColor': color }}>
                        <h1 className="font-emoji text-gray-800">💲</h1>
                    </div> : ""
            }
            <div className="" >
                <div className={`p-[3px]`} style={{ 'backgroundColor': color }} />
                <div className="p-5 space-y-5 h-[520px] overflow-auto relative">
                    {
                        includesUser && activity.isFree ?
                            <div className=" absolute top-0 right-0 m-2">
                                <button className="relative bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center focus:outline-none" onClick={() => { handleRemoveRegister(activity._id) }}>
                                    <div className="absolute w-[2px] h-4 sm:h-4 bg-white transform rotate-45"></div>
                                    <div className="absolute w-[2px] h-4 sm:h-4 bg-white transform -rotate-45"></div>
                                </button>
                            </div> : ""
                    }
                    {
                        includesUser && !activity.isFree ?
                            <div className=" absolute top-0 right-0 m-2">
                                <button className="relative bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center focus:outline-none" onClick={() => { setModalMessage("Para cancelar sua inscrição de um evento PAGO, entre em contato com a equipe COEPS.") }}>
                                    <div className="absolute w-[2px] h-4 sm:h-4 bg-white transform rotate-45"></div>
                                    <div className="absolute w-[2px] h-4 sm:h-4 bg-white transform -rotate-45"></div>
                                </button>
                            </div> : ""
                    }
                    <h1 className="font-extrabold text-center">
                        {
                            buttonText == "INSCREVER" && !includesUser ?
                                `[${nVagas} Vagas]` : ""
                        }

                    </h1>
                    <div className="text-center">
                        <h1 className="text-[100px] font-emoji text-gray-800">{activity.emoji}</h1>
                    </div>
                    <div >
                        <h1 className="font-bold text-center" >{activity.name.toLocaleUpperCase()}</h1>
                    </div>
                    <div>
                        <h1 className="font-thin text-center">
                            {activity.description}
                        </h1>
                    </div>
                    <h1>{ }</h1>
                </div>
                <div className="flex justify-center ">
                    <button className="p-4 font-bold text-white" onClick={() => {
                        activity.isFree ? handleRegister(activity._id) : handlePayedRegister(activity._id)
                    }} style={{ 'backgroundColor': color }} >
                        {
                            includesUser ? "INSCRITO" : activity.isOpen ? buttonText : "FECHADO"
                        }

                    </button> {/* INSCREVER|JÁ INSCRITO|FECHADO  */}
                </div>
            </div>
        </div>
    )
}

const LoadingModal = ({ isLoading }) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-[200]">
            <div className="flex flex-row content-center items-center justify-center p-5 rounded shadow-lg text-center bg-white">

                <svg className="flex flex-row content-center items-center justify-center animate-spin h-10 w-10 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z" />
                </svg>

                <p className="text-lg font-semibold p-4 text-black">Carregando</p>
            </div>
        </div>
    );
};
//
//
//
const WarningModalPayment = ({ href = "/pagamentos", message = "MENSAGEM NÃO DEFINIDA", textButton = "FECHAR", onClose = () => { }, closeModal = () => { }, isModal = 1 }) => {
    return (
        <>
            {
                isModal ?
                    <div className=" fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                        < div className="w-[85%] sm:w-full bg-white p-6 rounded-lg shadow-lg max-w-md " >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="text-yellow-500 text-2xl mr-2">⚠️</span>
                                    <h2 className="text-xl font-semibold text-gray-800">Aviso</h2>
                                </div>

                            </div>
                            <p className="mt-4 text-gray-600">{message}</p>
                            <div className="flex flex-row justify-end space-x-2 mt-6 text-right">
                                <button
                                    className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-400 transition"
                                    onClick={
                                        () => {
                                            closeModal(0)
                                            onClose()
                                        }
                                    }
                                >
                                    <Link href={href} prefetch={false} target="_blank">PAGAR</Link>
                                </button>
                                <button
                                    className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-400 transition"
                                    onClick={
                                        () => {
                                            closeModal(0)
                                            onClose()
                                        }
                                    }
                                >
                                    {textButton}
                                </button>
                            </div>
                        </div >
                    </div >
                    : ""
            }
        </>
    );
};