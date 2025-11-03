'use client'
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import WarningModal from "@/components/WarningModal"
import { DateTime } from "luxon"
import Link from "next/link"
import { DollarSign, Users, Calendar, Info, XCircle, CheckCircle, Clock, BookOpen, UserCheck, GraduationCap, Presentation, FlaskConical, Music, Award, Gamepad2, Heart, Stethoscope, Sparkles, Brain } from 'lucide-react';
import './style.css';
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

                const response = await fetch('/api/get/atividadesDisponiveis', { cache: 'no-cache' })
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
        <div className="atividades-main">
            <div className="atividades-container">
                <div className="atividades-header">
                    <h1 className="atividades-title">Atividades</h1>
                </div>
                <div className="atividades-intro">
                    <h1>O QUE TEMOS AQUI</h1>
                    <p>
                        Aqui, você pode se inscrever em <span className="atividades-highlight">atividades complementares</span>. É obrigatório que cada participante escolha atividades que somem no mínimo <span className="atividades-highlight">8 horas</span> (há atividades de 1 hora de duração e outras maiores, como as mesas de especialidades). Lembre-se de que cada uma possui um número máximo de participantes, portanto, programe-se para se inscrever a tempo! Não se preocupe, todas as informações necessárias estão disponíveis aqui. Após a inscrição, a atividade será adicionada automaticamente à <span className="atividades-highlight">Minha Programação</span>. Você consegue ver mais detalhes sobre as atividades <Link prefetch={false} target="_blank" href="/programacao"><span className="atividades-highlight" style={{ cursor: 'pointer' }}>clicando aqui</span></Link>.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>PRECISO PAGAR?</h1>
                    <p>
                        Grande parte das atividades é <span className="atividades-highlight">gratuita</span>. Entretanto, algumas podem ter cobranças simbólicas para viabilizar o evento. Atividades pagas estão marcadas com <DollarSign size={18} style={{ verticalAlign: 'middle', color: '#541A2C' }} />.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>QUANTAS ATIVIDADES EU POSSO ME INSCREVER?</h1>
                    <p>
                        Você pode se inscrever em <span className="atividades-highlight">quantas atividades quiser</span>. Caso queira retirar sua inscrição de algum dos eventos, basta clicar no botão <XCircle size={18} style={{ verticalAlign: 'middle', color: '#EF4444' }} /> presente no canto superior direito dos eventos que você está inscrito. Caso queira retirar sua inscrição de um evento pago, por favor entre em contato com a organização.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>REGRAS DE INSCRIÇÃO</h1>
                    <p style={{ textAlign: 'left' }}>
                        <CheckCircle size={16} style={{ color: '#1B305F', marginRight: 6, verticalAlign: 'middle' }} /> A soma das inscrições dos minicursos deve ser obrigatoriamente de no mínimo <span className="atividades-highlight">8 horas</span>.<br />
                        <Info size={16} style={{ color: '#1B305F', marginRight: 6, verticalAlign: 'middle' }} /> <b>NÃO</b> são permitidas inscrições em atividades com horários conflitantes. É de responsabilidade do congressista realizar um planejamento prévio antes da abertura das inscrições.<br />
                        <Calendar size={16} style={{ color: '#1B305F', marginRight: 6, verticalAlign: 'middle' }} /> O congressista tem acesso às datas de abertura das inscrições, horários, localizações e datas de realização das atividades <span className="atividades-highlight"><Link className="bg-red-600 p-1 text-white" href="/programacao" prefetch={false} target="_blank">CLICANDO AQUI</Link></span>.
                    </p>
                </div>
                <div className="atividades-status">
                    <h1>
                        {loadingData ? <span><Clock size={20} style={{ verticalAlign: 'middle', color: '#1B305F' }} /> CARREGANDO ATIVIDADES</span> : ''}
                        {!loadingData && data?.listEvents.length === 0 ? <span><Info size={20} style={{ verticalAlign: 'middle', color: '#541A2C' }} /> AINDA NÃO HÁ ATIVIDADES DISPONÍVEIS</span> : ''}
                        {!loadingData && data?.listEvents.length > 0 ? <span><BookOpen size={20} style={{ verticalAlign: 'middle', color: '#1B305F' }} /> ATIVIDADES DISPONÍVEIS</span> : ''}
                    </h1>
                </div>
                <div className="atividades-cards">
                    {!loadingData && data?.listEvents.length > 0 && (
                        <div className="w-full grid grid-cols-1 gap-x-10 gap-y-10 p-4 2xl:grid-cols-3 2xl:gap-2 2xl:gap-x-10 2xl:gap-y-10 lg:grid-cols-2 lg:gap-2 lg:gap-x-10 lg:gap-y-10">
                            {data?.listEvents.map((value) => (
                                <div key={value._id} className="atividades-card">
                                    <BannerAtividade activity={value} color={generateHexColor()} userId={data._id} />
                                </div>
                            ))}
                        </div>
                    )}
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
        <div className="atividades-card-container">
            <WarningModal message={modalMessage} textButton={"FECHAR"} closeModal={() => { setModalMessage(0) }} isModal={modalMessage} />
            <WarningModal message={modalMessage2} textButton={"RECARREGAR PÁGINA"} closeModal={() => { setModalMessage(0) }} isModal={modalMessage2} onClose={() => { window.location.reload() }} />
            <WarningModalPayment href={modal3Link} message={modalMessage3} textButton={"FECHAR"} closeModal={() => { setModalMessage3(0) }} isModal={modalMessage3} />
            <LoadingModal isLoading={loadingModal} />

            {
                !activity.isFree ?
                    <div className="atividades-preco-tag">
                        <span>{activity?.value ? activity?.value : ""}</span>
                        <DollarSign size={18} style={{ color: '#541A2C' }} />
                    </div> : ""
            }
            {
                buttonText == "INSCREVER" && !includesUser ?
                    <div className="atividades-vagas-tag">
                        <span>{nVagas} Vagas</span>
                    </div> : ""
            }
            <div className="atividades-card-content">
                <div className={`atividades-card-header-border`} style={{ 'backgroundColor': color }} />
                <div className="atividades-card-body">
                    {
                        includesUser && activity.isFree ?
                            <div className="atividades-remove-button-container">
                                <button className="atividades-remove-button" onClick={() => { handleRemoveRegister(activity._id) }}>
                                    <XCircle size={20} />
                                </button>
                            </div> : ""
                    }
                    {
                        includesUser && !activity.isFree ?
                            <div className="atividades-remove-button-container">
                                <button className="atividades-remove-button" onClick={() => { setModalMessage("Para cancelar sua inscrição de um evento PAGO, entre em contato com a equipe COEPS.") }}>
                                    <XCircle size={20} />
                                </button>
                            </div> : ""
                    }
                    <div className="atividades-card-icon">{getActivityIcon(activity)}</div>
                    <div className="atividades-card-title">
                        <h1 className="font-bold text-center" >{activity.name.toLocaleUpperCase()}</h1>
                        <div className='text-[13px] font-semibold text-center pt-2'>
                            <h2>{new Date(activity.timeline[0].date_init).toLocaleString()} às {new Date(activity.timeline[0].date_end).toLocaleString()}</h2>
                        </div>
                    </div>
                    <div className="atividades-card-description">
                        <h1 className="font-thin text-center break-words whitespace-normal">
                            {activity.description}
                        </h1>
                    </div>
                    <h1>{ }</h1>
                </div>
                <div className="atividades-card-footer">
                    <button className="atividades-card-button" onClick={() => {
                        activity.isFree ? handleRegister(activity._id) : handlePayedRegister(activity._id)
                    }} style={{ 'backgroundColor': color }} >
                        {
                            ""
                        }

                    </button> {/* INSCREVER|JÁ INSCRITO|FECHADO  */}
                </div>
            </div>
            {
                (buttonText === 'FECHADO' || !activity.isOpen) &&
                    <div className="atividades-fechado">FECHADO</div>
            }
            {
                buttonText === 'CHEIO' &&
                    <div className="atividades-cheio">CHEIO</div>
            }
            {
                buttonText === 'INSCREVER' && !includesUser &&
                    <div 
                        className="atividades-inscrever" 
                        onClick={() => {
                            activity.isFree ? handleRegister(activity._id) : handlePayedRegister(activity._id)
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        INSCREVER
                    </div>
            }
            {
                includesUser && <div className="atividades-inscrito">INSCRITO</div>
            }
        </div>
    )
}

const LoadingModal = ({ isLoading }) => {
    if (!isLoading) return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-[9999]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="flex flex-row content-center items-center justify-center p-5 rounded shadow-lg text-center bg-white">
                <svg className="flex flex-row content-center items-center justify-center animate-spin h-10 w-10 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z" />
                </svg>
                <p className="text-lg font-semibold p-4 text-black">Carregando</p>
            </div>
        </div>,
        typeof window !== 'undefined' ? document.body : document.createElement('div')
    );
};
//
//
//
const WarningModalPayment = ({ href = "/pagamentos", message = "MENSAGEM NÃO DEFINIDA", textButton = "FECHAR", onClose = () => { }, closeModal = () => { }, isModal = 1 }) => {
    return (
        <>
            {isModal ? createPortal(
                <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black bg-opacity-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="w-[85%] sm:w-full bg-white p-6 rounded-lg shadow-lg max-w-md ">
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
                                onClick={() => {
                                    closeModal(0)
                                    onClose()
                                }}
                            >
                                <Link href={href} prefetch={false} target="_blank">PAGAR</Link>
                            </button>
                            <button
                                className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-400 transition"
                                onClick={() => {
                                    closeModal(0)
                                    onClose()
                                }}
                            >
                                {textButton}
                            </button>
                        </div>
                    </div>
                </div>,
                typeof window !== 'undefined' ? document.body : document.createElement('div')
            ) : ""}
        </>
    );
};

// No BannerAtividade, trocar o emoji do topo por um ícone Lucide apropriado conforme o tipo de atividade
const getActivityIcon = (activity) => {
  if (!activity) return <BookOpen size={48} />;
  const name = activity.name?.toLowerCase() || '';
  if (!activity.isFree) return <DollarSign size={48} color="#541A2C" />;
  if (name.includes('minicurso') || name.includes('workshop') || name.includes('curso')) return <GraduationCap size={48} color="#1B305F" />;
  if (name.includes('palestra') || name.includes('conferência') || name.includes('apresentação')) return <Presentation size={48} color="#1B305F" />;
  if (name.includes('pesquisa') || name.includes('científico') || name.includes('estudo')) return <FlaskConical size={48} color="#1B305F" />;
  if (name.includes('festa') || name.includes('social') || name.includes('confraternização')) return <Music size={48} color="#1B305F" />;
  if (name.includes('premiação') || name.includes('competição') || name.includes('concurso') || name.includes('premio')) return <Award size={48} color="#1B305F" />;
  if (name.includes('mesa') || name.includes('grupo') || name.includes('equipe')) return <Users size={48} color="#1B305F" />;
  if (name.includes('trabalho') || name.includes('artigo') || name.includes('publicação')) return <BookOpen size={48} color="#1B305F" />;
  if (name.includes('jogo') || name.includes('lúdico') || name.includes('interativo')) return <Gamepad2 size={48} color="#1B305F" />;
  if (name.includes('saúde') || name.includes('médico') || name.includes('clínico') || name.includes('cardio')) return <Heart size={48} color="#1B305F" />;
  if (name.includes('inovação') || name.includes('tecnologia') || name.includes('moderno')) return <Brain size={48} color="#1B305F" />;
  if (name.includes('vivência') || name.includes('atividade') || name.includes('experiência')) return <Sparkles size={48} color="#1B305F" />;
  return <Calendar size={48} color="#1B305F" />;
};