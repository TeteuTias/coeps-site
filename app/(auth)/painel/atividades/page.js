'use client'
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import WarningModal from "@/components/WarningModal"
import { DateTime } from "luxon"
import Link from "next/link"
import { DollarSign, Users, Calendar, Info, XCircle, CheckCircle, Clock, BookOpen, GraduationCap, Presentation, FlaskConical, Music, Award, Gamepad2, Heart, Sparkles, Brain, Search, MapPin, CheckCircle2 } from 'lucide-react';
import { AsyncStatePanel } from '@/components/cieps';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';
import './style.css';

const activityColors = ['#a32d2d', '#185fa5', '#ef9f27', '#1a1a1a'];
//
//
//
export default function Minicursos() {
    const [loadingData, setLoadingData] = useState(1)
    const [data, setData] = useState({ _id: undefined, listEvents: [] })
    const [searchTerm, setSearchTerm] = useState('')
    const [loadError, setLoadError] = useState(null)

    //
    //
    useEffect(() => {
        const fetchData = async () => {
            try {

                const response = await fetchWithTimeout('/api/get/atividadesDisponiveis', { cache: 'no-cache' })
                const jsonResponse = await readJsonResponse(response)
                if (!response.ok) {
                    throw new Error(jsonResponse?.message || 'Falha ao consultar atividades')
                }
                setData(jsonResponse)
                setLoadError(null)
            }
            catch (error) {
                setLoadError(error instanceof Error ? error.message : 'Não foi possível consultar as atividades.')
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
                        Aqui, você pode se inscrever em <span className="atividades-highlight">atividades complementares</span>. Após a inscrição, a atividade será adicionada automaticamente à <span className="atividades-highlight">Minha Programação</span>. Para ver mais detalhes sobre as atividades, <Link prefetch={false} target="_blank" href="/programacao"><span className="atividades-highlight" style={{ cursor: 'pointer' }}>clique aqui</span></Link>.
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
                        Você pode se inscrever em <span className="atividades-highlight">quantas atividades quiser</span>. Caso queira retirar sua inscrição de algum evento, basta clicar no botão <XCircle size={18} style={{ verticalAlign: 'middle', color: '#EF4444' }} /> presente no canto superior direito dos eventos nos quais você está inscrito. Caso queira retirar sua inscrição de um evento pago, entre em contato com a organização.
                    </p>
                </div>
                <div className="atividades-intro">
                    <h1>REGRAS DE INSCRIÇÃO</h1>
                    <p style={{ textAlign: 'left' }}>
                        <CheckCircle size={16} style={{ color: '#1B305F', marginRight: 6, verticalAlign: 'middle' }} /> A soma das inscrições dos minicursos deve totalizar, no mínimo, <span className="atividades-highlight">8 horas</span>.<br />
                        <Info size={16} style={{ color: '#1B305F', marginRight: 6, verticalAlign: 'middle' }} /> <b>NÃO</b> são permitidas inscrições em atividades com horários conflitantes. É de responsabilidade do congressista realizar um planejamento prévio antes da abertura das inscrições.<br />
                        <Calendar size={16} style={{ color: '#185FA5', marginRight: 6, verticalAlign: 'middle' }} /> O congressista pode consultar as datas de abertura das inscrições, os horários, os locais e as datas de realização das atividades <span className="atividades-highlight"><Link className="font-bold text-[var(--cieps-blue)] underline" href="/programacao" prefetch={false} target="_blank">clicando aqui</Link></span>.
                    </p>
                </div>
                <div className="atividades-status">
                    <h1>
                        {loadingData ? <span><Clock size={20} style={{ verticalAlign: 'middle', color: '#1B305F' }} /> CARREGANDO ATIVIDADES</span> : ''}
                        {!loadingData && loadError ? <span><Info size={20} style={{ verticalAlign: 'middle', color: '#A32D2D' }} /> ATIVIDADES INDISPONÍVEIS</span> : ''}
                        {!loadingData && !loadError && data?.listEvents.length === 0 ? <span><Info size={20} style={{ verticalAlign: 'middle', color: '#A32D2D' }} /> AINDA NÃO HÁ ATIVIDADES DISPONÍVEIS</span> : ''}
                        {!loadingData && data?.listEvents.length > 0 ? <span><BookOpen size={20} style={{ verticalAlign: 'middle', color: '#1B305F' }} /> ATIVIDADES DISPONÍVEIS</span> : ''}
                    </h1>
                </div>
                {!loadingData && data?.listEvents.length > 0 && (
                    <div className="atividades-search-container">
                        <div className="atividades-search-wrapper">
                            <Search size={20} className="atividades-search-icon" />
                            <input
                                type="text"
                                aria-label="Pesquisar atividades"
                                placeholder="Pesquisar atividades..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="atividades-search-input"
                            />
                        </div>
                    </div>
                )}
                <div className="atividades-cards">
                    {!loadingData && loadError && (
                        <AsyncStatePanel
                            status="error"
                            errorTitle="Atividades indisponíveis"
                            message={loadError}
                            onRetry={() => setLoadingData(1)}
                        />
                    )}
                    {!loadingData && data?.listEvents.length > 0 && (() => {
                        const filteredEvents = data.listEvents.filter((value) => {
                            const searchLower = searchTerm.toLowerCase();
                            return (
                                value.name?.toLowerCase().includes(searchLower) ||
                                value.description?.toLowerCase().includes(searchLower)
                            );
                        });
                        
                        return filteredEvents.length > 0 ? (
                            <div className="atividades-grid">
                                {filteredEvents.map((value, index) => (
                                    <div key={value._id} className="atividade-card-slot">
                                        <BannerAtividade activity={value} color={activityColors[index % activityColors.length]} userId={data._id} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="atividades-no-results">
                                <Info size={24} style={{ verticalAlign: 'middle', color: '#541A2C' }} />
                                <p>Nenhuma atividade encontrada com o termo *{searchTerm}*</p>
                            </div>
                        );
                    })()}
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

const formatTimeline = (timeline) => {
    if (!Array.isArray(timeline) || timeline.length === 0) {
        return [{ label: 'Data e horário a confirmar', location: '' }]
    }

    return timeline.map((item) => {
        const start = DateTime.fromISO(item?.date_init || '', { zone: 'America/Sao_Paulo' })
            .setLocale('pt-BR')
        const end = DateTime.fromISO(item?.date_end || '', { zone: 'America/Sao_Paulo' })
            .setLocale('pt-BR')

        if (!start.isValid || !end.isValid) {
            return {
                label: 'Data e horário a confirmar',
                location: item?.local || item?.local_description || '',
            }
        }

        const sameDay = start.hasSame(end, 'day')
        return {
            label: sameDay
                ? `${start.toFormat("dd 'de' LLLL")} · ${start.toFormat('HH:mm')}–${end.toFormat('HH:mm')}`
                : `${start.toFormat("dd LLL, HH:mm")} – ${end.toFormat("dd LLL, HH:mm")}`,
            location: item?.local || item?.local_description || '',
        }
    })
}

const formatOpeningDate = (value) => {
    const date = DateTime.fromISO(value || '', { zone: 'America/Sao_Paulo' }).setLocale('pt-BR')
    return date.isValid ? date.toFormat("dd 'de' LLLL, HH:mm") : null
}

const activityPriceLabel = (activity) => {
    if (activity.isFree) return 'Gratuita'
    if (activity.value === undefined || activity.value === null || activity.value === '') {
        return 'Atividade paga'
    }
    return `R$ ${String(activity.value).replace(/^R\$\s*/i, '')}`
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
    const initialParticipants = Array.isArray(activity.participants) ? activity.participants : []
    const [participantCount, setParticipantCount] = useState(initialParticipants.length)
    const [buttonText, setButtonText] = useState(isDateEqualOrAfterToday(activity.dateOpen, initialParticipants.length, activity.maxParticipants))
    const [includesUser, setIncludesUser] = useState(initialParticipants.includes(userId))
    const [modalMessage, setModalMessage] = useState(0)
    const [modalMessage3, setModalMessage3] = useState(0)
    const [modal3Link, setModal3Link] = useState("/pagamentos")
    const [loadingModal, setLoadingModal] = useState(0)
    const [showConfirmRemove, setShowConfirmRemove] = useState(false)
    const nVagas = Math.max(0, Number(activity.maxParticipants || 0) - participantCount)
    const timeline = formatTimeline(activity.timeline)
    const openingDate = formatOpeningDate(activity.dateOpen)
    const visualState = includesUser
        ? 'registered'
        : !activity.isOpen
            ? 'closed'
            : buttonText === 'CHEIO'
                ? 'full'
                : buttonText === 'FECHADO'
                    ? 'not-open'
                    : 'open'
    const stateLabel = {
        registered: 'Inscrito',
        closed: 'Inscrições encerradas',
        full: 'Vagas esgotadas',
        'not-open': 'Inscrições em breve',
        open: 'Inscrições abertas',
    }[visualState]
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
            const response = await fetchWithTimeout('/api/put/inscreverAtividade', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ eventId }),
            });

            const result = await readJsonResponse(response);

            if (!response.ok) {
                if (response.status == 403) {
                    setButtonText('CHEIO')
                    setModalMessage(result.message)
                    return 0
                }
                if (response.status == 500) {
                    setModalMessage(result.message)

                }
                setModalMessage(result.message)
                throw new Error(result.message || 'Algo ocorreu errado. Tente novamente.');
            }
            // handleAlreadyInscribed()
            setIncludesUser(1)
            setParticipantCount((count) => count + 1)
            setModalMessage(result.message)
            setButtonText('INSCRITO')
        } catch (error) {
            setModalMessage(error instanceof Error ? error.message : 'Não foi possível concluir a inscrição.')
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
            const response = await fetchWithTimeout('/api/payment/createActivityPayment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ eventId }),
            });

            const result = await readJsonResponse(response);

            if (!response.ok) {
                if (response.status == 403) {
                    setButtonText('CHEIO')
                    setModalMessage(result.message)
                    return 0
                }
                if (response.status == 500) {
                    setModalMessage(result.message)

                }
                setModalMessage(result.message)
                throw new Error(result.message || 'Algo ocorreu errado. Tente novamente.');
            }
            // handleAlreadyInscribed()
            setIncludesUser(1)
            setParticipantCount((count) => count + 1)
            setModalMessage3(result.message)
            setModal3Link(result.link || "/pagamentos")
            setButtonText('INSCRITO')
        } catch (error) {
            setModalMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.')
        } finally {
            setLoadingModal(0)
        }
    };
    const handleRemoveRegister = async (eventId) => {
        setShowConfirmRemove(false)
        setLoadingModal(1)

        switch (true) {
            case (!includesUser):
                setModalMessage("Você não está inscrito no evento, portanto, não é possível retirar sua inscrição.")
                return 0
        }

        try {
            const response = await fetchWithTimeout('/api/delete/desinscreverAtividade', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ eventId }),
            });

            const result = await readJsonResponse(response);

            if (!response.ok) {
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
            setIncludesUser(0)
            setParticipantCount((count) => Math.max(0, count - 1))
            setButtonText(isDateEqualOrAfterToday(activity.dateOpen, Math.max(0, participantCount - 1), activity.maxParticipants))
            setModalMessage(result.message)
        } catch (error) {
            setModalMessage(error instanceof Error ? error.message : 'Não foi possível retirar sua inscrição.')
        } finally {
            setLoadingModal(0)
        }
    };
    return (
        <article className={`atividades-card-container atividade-state-${visualState}`} style={{ '--atividade-accent': color }}>
            <WarningModal message={modalMessage} textButton={"FECHAR"} closeModal={() => { setModalMessage(0) }} isModal={modalMessage} />
            <WarningModalPayment href={modal3Link} message={modalMessage3} textButton={"FECHAR"} closeModal={() => { setModalMessage3(0) }} isModal={modalMessage3} />
            <LoadingModal isLoading={loadingModal} />
            <ConfirmRemoveModal 
                isOpen={showConfirmRemove} 
                onClose={() => setShowConfirmRemove(false)} 
                onConfirm={() => handleRemoveRegister(activity._id)}
                activityName={activity.name}
            />

            {
                !activity.isFree ?
                    <div className="atividades-preco-tag">
                        <span>{activityPriceLabel(activity)}</span>
                        <DollarSign size={18} style={{ color: '#541A2C' }} />
                    </div> : ""
            }
            {
                buttonText == "INSCREVER" && !includesUser ?
                    <div className="atividades-vagas-tag">
                        <span>{nVagas} {nVagas === 1 ? 'vaga' : 'vagas'}</span>
                    </div> : ""
            }
            <div className="atividades-card-content">
                <div className={`atividades-card-header-border`} style={{ 'backgroundColor': color }} />
                <div className="atividades-card-body">
                    {
                        includesUser && activity.isFree ?
                            <div className="atividades-remove-button-container">
                                <button type="button" className="atividades-remove-button" aria-label="Cancelar inscrição" title="Cancelar inscrição" onClick={() => { setShowConfirmRemove(true) }}>
                                    <XCircle size={24} aria-hidden="true" />
                                    <span className="sr-only">Cancelar inscrição</span>
                                </button>
                            </div> : ""
                    }
                    {
                        includesUser && !activity.isFree ?
                            <div className="atividades-remove-button-container">
                                <button type="button" className="atividades-remove-button" aria-label="Ver orientações para cancelar inscrição paga" title="Ver orientações para cancelar inscrição paga" onClick={() => { setModalMessage("Para cancelar sua inscrição de um evento PAGO, entre em contato com a equipe CIEPS.") }}>
                                    <XCircle size={24} aria-hidden="true" />
                                    <span className="sr-only">Ver orientações para cancelar</span>
                                </button>
                            </div> : ""
                    }
                    <div className="atividades-card-icon">{getActivityIcon(activity, 32)}</div>
                    <div className="atividades-card-title">
                        <h1 className="font-bold text-center" >{activity.name.toLocaleUpperCase()}</h1>
                        <div className='text-[13px] font-semibold text-center pt-2'>
                            <p className="atividades-card-date"><Calendar size={15} aria-hidden="true" /> {timeline[0].label}</p>
                            {timeline[0].location && <p className="atividades-card-location"><MapPin size={14} aria-hidden="true" /> {timeline[0].location}</p>}
                        </div>
                    </div>
                    <div className="atividades-card-description">
                        <h1 className="font-thin text-center break-words whitespace-normal">
                            {activity.description}
                        </h1>
                    </div>
                    {timeline.length > 1 && <p className="atividades-card-more-dates">+ {timeline.length - 1} outro{timeline.length > 2 ? 's' : ''} horário{timeline.length > 2 ? 's' : ''}</p>}
                </div>
            </div>
            {
                ['closed', 'not-open'].includes(visualState) &&
                    <div className="atividades-fechado">
                        <strong>{stateLabel}</strong>
                        {visualState === 'not-open' && openingDate && <span>Disponível em {openingDate}</span>}
                    </div>
            }
            {
                visualState === 'full' &&
                    <div className="atividades-cheio">{stateLabel}</div>
            }
            {
                visualState === 'open' &&
                    <button
                        type="button"
                        className="atividades-inscrever" 
                        onClick={() => {
                            activity.isFree ? handleRegister(activity._id) : handlePayedRegister(activity._id)
                        }}
                        disabled={Boolean(loadingModal)}
                    >
                        {loadingModal ? 'PROCESSANDO...' : activity.isFree ? 'INSCREVER-SE' : 'INSCREVER-SE E PAGAR'}
                    </button>
            }
            {
                visualState === 'registered' && <div className="atividades-inscrito"><CheckCircle2 size={15} /> {stateLabel}</div>
            }
        </article>
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

// Modal de confirmação para remover inscrição
const ConfirmRemoveModal = ({ isOpen, onClose, onConfirm, activityName }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black bg-opacity-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="w-[85%] sm:w-full bg-white p-6 rounded-lg shadow-lg max-w-md">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <XCircle size={24} className="text-red-500 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-800">Confirmar Desinscrição</h2>
                    </div>
                </div>
                <p className="mt-4 text-gray-600 mb-2">
                    Tem certeza que deseja se desinscrever da atividade:
                </p>
                <p className="text-gray-800 font-semibold mb-4 text-center bg-gray-100 p-2 rounded">
                    {activityName?.toUpperCase()}
                </p>
                <p className="text-sm text-gray-500 mb-6 text-center">
                    Esta ação não pode ser desfeita.
                </p>
                <div className="flex flex-row justify-end space-x-2 mt-6">
                    <button
                        className="bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400 transition font-semibold"
                        onClick={onClose}
                    >
                        CANCELAR
                    </button>
                    <button
                        className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition font-semibold"
                        onClick={onConfirm}
                    >
                        CONFIRMAR
                    </button>
                </div>
            </div>
        </div>,
        typeof window !== 'undefined' ? document.body : document.createElement('div')
    );
};

// No BannerAtividade, trocar o emoji do topo por um ícone Lucide apropriado conforme o tipo de atividade
const getActivityIcon = (activity, size = 32) => {
  if (!activity) return <BookOpen size={size} />;
  const name = activity.name?.toLowerCase() || '';
  if (!activity.isFree) return <DollarSign size={size} />;
  if (name.includes('minicurso') || name.includes('workshop') || name.includes('curso')) return <GraduationCap size={size} />;
  if (name.includes('palestra') || name.includes('conferência') || name.includes('apresentação')) return <Presentation size={size} />;
  if (name.includes('pesquisa') || name.includes('científico') || name.includes('estudo')) return <FlaskConical size={size} />;
  if (name.includes('festa') || name.includes('social') || name.includes('confraternização')) return <Music size={size} />;
  if (name.includes('premiação') || name.includes('competição') || name.includes('concurso') || name.includes('premio')) return <Award size={size} />;
  if (name.includes('mesa') || name.includes('grupo') || name.includes('equipe')) return <Users size={size} />;
  if (name.includes('trabalho') || name.includes('artigo') || name.includes('publicação')) return <BookOpen size={size} />;
  if (name.includes('jogo') || name.includes('lúdico') || name.includes('interativo')) return <Gamepad2 size={size} />;
  if (name.includes('saúde') || name.includes('médico') || name.includes('clínico') || name.includes('cardio')) return <Heart size={size} />;
  if (name.includes('inovação') || name.includes('tecnologia') || name.includes('moderno')) return <Brain size={size} />;
  if (name.includes('vivência') || name.includes('atividade') || name.includes('experiência')) return <Sparkles size={size} />;
  return <Calendar size={size} />;
};
