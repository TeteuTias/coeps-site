'use client'
import { useEffect, useState } from "react"
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
        <div className="atividades-main">
            <div className="atividades-container">
                <div className="atividades-header">
                    <h1 className="atividades-title">Atividades</h1>
                </div>
                <div className="atividades-intro">
                    <h1>O QUE TEMOS AQUI</h1>
                    <p className="atividades-intro-textoazul">
                        Aqui, você pode se inscrever em <span className="atividades-highlight">atividades complementares</span>. É obrigatório que cada participante escolha atividades que somem no mínimo <span className="atividades-highlight">8 horas</span> (há atividades de 1 hora de duração e outras maiores, como as mesas de especialidades). Lembre-se de que cada uma possui um número máximo de participantes, portanto, programe-se para se inscrever a tempo! Não se preocupe, todas as informações necessárias estão disponíveis aqui. Após a inscrição, a atividade será adicionada automaticamente à <span className="atividades-highlight">Minha Programação</span>. Você consegue ver mais detalhes sobre as atividades <Link prefetch={false} target="_blank" href="/programacao"><span className="atividades-highlight" style={{ cursor: 'pointer' }}>clicando aqui</span></Link>.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>PRECISO PAGAR?</h1>
                    <p className="atividades-intro-textoazul">
                        Grande parte das atividades é <span className="atividades-highlight">gratuita</span>. Entretanto, algumas podem ter cobranças simbólicas para viabilizar o evento. Atividades pagas estão marcadas com <DollarSign size={18} style={{ verticalAlign: 'middle', color: '#541A2C' }} />.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>QUANTAS ATIVIDADES EU POSSO ME INSCREVER?</h1>
                    <p className="atividades-intro-textoazul">
                        Você pode se inscrever em <span className="atividades-highlight">quantas atividades quiser</span>. Caso queira retirar sua inscrição de algum dos eventos, basta clicar no botão <XCircle size={18} style={{ verticalAlign: 'middle', color: '#EF4444' }} /> presente no canto superior direito dos eventos que você está inscrito. Caso queira retirar sua inscrição de um evento pago, por favor entre em contato com a organização.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>REGRAS DE INSCRIÇÃO</h1>
                    <p className="atividades-intro-textoazul" style={{ textAlign: 'left' }}>
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
            {/* NOVA TAG DE VAGAS */}
            {buttonText == "INSCREVER" && !includesUser && (
                <div className="atividades-vagas-tag">
                    <span>{nVagas} vagas</span>
                </div>
            )}
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
                    <h1 className="atividades-card-title">
                        {
                            buttonText == "INSCREVER" && !includesUser ?
                                "" : ""
                        }

                    </h1>
                    <div className="atividades-card-icon">{getActivityIcon(activity)}</div>
                    <div className="atividades-card-title">
                        <h1 className="font-bold text-center" >{activity.name.toLocaleUpperCase()}</h1>
                        <div className='text-[13px] font-semibold text-center pt-2'>
                            <h2>{new Date(activity.timeline[0].date_init).toLocaleString()} às {new Date(activity.timeline[0].date_end).toLocaleString()}</h2>
                        </div>
                    </div>
                    <div className="atividades-card-description">
                        <p className="atividades-card-descricao-azul font-thin text-center break-words whitespace-normal">
                            {activity.description}
                        </p>
                    </div>
                    <h1>{ }</h1>
                </div>
                <div className="atividades-card-footer">
                    <button className="atividades-card-button" onClick={() => {
                        activity.isFree ? handleRegister(activity._id) : handlePayedRegister(activity._id)
                    }} style={{ 'backgroundColor': color }} >
                        {
                            includesUser ? "" : ""
                        }

                    </button> {/* JÁ INSCRITO|FECHADO  */}
                </div>
            </div>
            {
                (buttonText === 'FECHADO' || !activity.isOpen) &&
                    <div className="atividades-fechado">FECHADO</div>
            }
            {
                includesUser && <div className="atividades-inscrito">INSCRITO</div>
            }
            {
                buttonText === 'INSCREVER' && !includesUser && activity.isOpen &&
                    <div 
                        className="atividades-inscrever" 
                        onClick={() => {
                            activity.isFree ? handleRegister(activity._id) : handlePayedRegister(activity._id)
                        }}
                    >
                        INSCREVA-SE
                    </div>
            }
        </div>
    )
}

const LoadingModal = ({ isLoading }) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-[200] modal-overlay">
            <div className="flex flex-col items-center justify-center p-8 rounded-2xl shadow-2xl text-center bg-white/90 backdrop-blur-xl border border-white/30 max-w-sm mx-4 modal-content modal-animate-in">
                {/* Spinner personalizado com cores do site */}
                <div className="relative mb-6">
                    <div className="w-16 h-16 border-4 border-[#D8D9DA] border-t-[#541A2C] rounded-full animate-spin"></div>
                </div>
                
                {/* Texto estilizado */}
                <div className="text-center">
                    <h3 className="text-xl font-bold text-[#541A2C] mb-2">Processando...</h3>
                    <p className="text-[#1B305F] font-medium">Aguarde um momento</p>
                </div>
                
                {/* Indicador de progresso animado */}
                <div className="mt-6 w-full bg-[#D8D9DA] rounded-full h-2 overflow-hidden">
                    <div className="h-full progress-bar" style={{width: '60%'}}></div>
                </div>
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
                    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 backdrop-blur-sm modal-overlay">
                        <div className="w-[90%] sm:w-full bg-white/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md mx-4 border border-white/30 modal-content modal-animate-in">
                            {/* Header com ícone e título */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[#541A2C] to-[#1B305F] rounded-full flex items-center justify-center mr-4">
                                        <span className="text-white text-2xl">⚠️</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-[#541A2C]">Aviso</h2>
                                </div>
                            </div>

                            {/* Mensagem */}
                            <div className="mb-8">
                                <p className="text-[#1B305F] text-lg leading-relaxed font-medium">{message}</p>
                            </div>

                            {/* Botões */}
                            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
                                <button
                                    className="modal-button-primary"
                                    onClick={() => {
                                        closeModal(0)
                                        onClose()
                                    }}
                                >
                                    <Link href={href} prefetch={false} target="_blank" className="flex items-center justify-center">
                                        <span>PAGAR</span>
                                    </Link>
                                </button>
                                <button
                                    className="modal-button-secondary"
                                    onClick={() => {
                                        closeModal(0)
                                        onClose()
                                    }}
                                >
                                    {textButton}
                                </button>
                            </div>
                        </div>
                    </div>
                    : ""
            }
        </>
    );
};

// No BannerAtividade, trocar o emoji do topo por um ícone Lucide apropriado conforme o tipo de atividade
const getActivityIcon = (activity) => {
  if (!activity) return <BookOpen size={48} />;
  const name = activity.name?.toLowerCase() || '';
  if (!activity.isFree) return <DollarSign size={48} color="#541A2C" />;
  // Temas militares
  if (name.match(/militar|ex[ée]rcito|for[çc]a armada|caserna|pol[íi]cia|batalh[aã]o|farda/)) return <Award size={48} color="#1B305F" />;
  // Temas hospitalares
  if (name.match(/hospital|pronto socorro|santa casa|padre julio|cl[íi]nica/)) return <Stethoscope size={48} color="#1B305F" />;
  // Temas de saúde geral
  if (name.match(/enfermagem|medicina|saúde|cardio|cirurgia|enfermeiro|médico|paciente|emergência/)) return <Heart size={48} color="#1B305F" />;
  // Temas de pesquisa/científico
  if (name.match(/pesquisa|cient[ií]fico|estudo|laborat[óo]rio|experimento|ciência/)) return <FlaskConical size={48} color="#1B305F" />;
  // Temas de ensino/minicurso/curso
  if (name.match(/minicurso|workshop|curso|aula|treinamento|capacita[cç][aã]o|oficina/)) return <GraduationCap size={48} color="#1B305F" />;
  // Temas de palestra/conferência
  if (name.match(/palestra|confer[eê]ncia|apresenta[cç][aã]o|talk|semin[aá]rio/)) return <Presentation size={48} color="#1B305F" />;
  // Temas de premiação/competição
  if (name.match(/premia[cç][aã]o|compet[ií][cç][aã]o|concurso|premio|prêmio|olimp[ií]ada/)) return <Award size={48} color="#1B305F" />;
  // Temas de social/festa
  if (name.match(/festa|social|confraterniza[cç][aã]o|happy hour|balada|música|show/)) return <Music size={48} color="#1B305F" />;
  // Temas de grupo/mesa redonda
  if (name.match(/mesa|grupo|equipe|debate|rodada|discuss[aã]o/)) return <Users size={48} color="#1B305F" />;
  // Temas de trabalhos/artigos
  if (name.match(/trabalho|artigo|publica[cç][aã]o|resumo|painel/)) return <BookOpen size={48} color="#1B305F" />;
  // Temas de jogos/lúdico
  if (name.match(/jogo|l[úu]dico|interativo|gincana|game/)) return <Gamepad2 size={48} color="#1B305F" />;
  // Temas de inovação/tecnologia
  if (name.match(/inova[cç][aã]o|tecnologia|moderno|startup|digital/)) return <Brain size={48} color="#1B305F" />;
  // Temas de vivência/experiência
  if (name.match(/viv[êe]ncia|atividade|experi[eê]ncia|pr[aá]tica|imers[aã]o/)) return <Sparkles size={48} color="#1B305F" />;
  // Temas de voluntariado/solidariedade
  if (name.match(/volunt[aá]rio|solidariedade|ajuda|doa[cç][aã]o|beneficente/)) return <Heart size={48} color="#1B305F" />;
  // Temas de organização/planejamento
  if (name.match(/organiza[cç][aã]o|planejamento|gest[aã]o|administra[cç][aã]o/)) return <UserCheck size={48} color="#1B305F" />;
  // Default
  return <Calendar size={48} color="#1B305F" />;
};