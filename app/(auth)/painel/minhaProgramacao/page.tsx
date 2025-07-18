'use client'
import { useEffect, useState } from "react";
import { ICourse, ILecture } from "@/lib/types/events/event.t";
import { Calendar, Clock, MapPin, Info, X, Loader2 } from 'lucide-react';
import './style.css';

export default function MinhaProgramacao() {
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [data, setData] = useState(undefined)
  const [modal, setModal] = useState(undefined)

  const handleModal = (event) => {
    setModal(event)
  }

  const handleIsFetching = (event) => {
    setIsFetching(event)
  }

  const handleData = (event) => {
    setData(event)
  }

  useEffect(() => {
    const enviarRequisicaoGet = async () => {
      try {
        const response = await fetch('/api/get/usuariosProgramacao', {
          cache: 'no-cache',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Falha ao enviar a requisição GET');
        }

        const responseData: { minicursos: ICourse[], palestras: ILecture[] } = await response.json();

        handleIsFetching(false)
        handleData({ "data": organizeData(responseData) })
      } catch (error) {
        console.error('Erro ao enviar a requisição GET:', error);
      }
    };
    enviarRequisicaoGet();
  }, []);

  return (
    <div className="programacao-main">
      {modal && <Modal handleModal={() => handleModal(0)} modal={modal} />}
      
      <div className="programacao-container">
        <div className="programacao-header">
          <h1 className="programacao-title">Minha Programação</h1>
        </div>

        <div className="programacao-intro">
          <h1>O QUE TEMOS AQUI</h1>
          <p>
            Aqui está o seu cronograma de eventos! Todos os eventos obrigatórios e aqueles em que você se inscreveu estão organizados para que você
            não fique perdido. Não se esqueça de se inscrever nos minicursos! 
            <span className="programacao-highlight">
              Clicando nos cards, você consegue mais informações sobre o evento presente na sua agenda.
            </span>
          </p>
        </div>

        <div className="programacao-cards-container">
          {isFetching ? (
            <div className="programacao-loading">
              <h1>CARREGANDO</h1>
              <div className="programacao-loading-animation"></div>
            </div>
          ) : data?.data ? (
            Object.keys(data?.data).map(key => (
              <CardProgramacao 
                dateKey={key} 
                event={data?.data[key]} 
                key={Math.floor(Math.random() * 100)} 
                handleModal={handleModal} 
              />
            ))
          ) : (
            <div className="programacao-empty">
              <h1>Você ainda não possui uma programação</h1>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function organizeData(data) {
  const organized = {};
  
  data['palestras'].map((value1, index) => {
    value1.timeline.map((value2) => {
      value2.namePattern = value1.name
      value2.descriptionPattern = value1.description,
      value2.organization_namePattern = value1.organization_name,
      value2.timelinePattern = value1.timeline
    })
  })
  
  data['minicursos'].map((value1, index) => {
    value1.timeline.map((value2) => {
      value2.namePattern = value1.name
      value2.descriptionPattern = value1.description,
      value2.organization_namePattern = value1.organization_name,
      value2.timelinePattern = value1.timeline
    })
  })

  const allEvents = [
    ...(Array.isArray(data.minicursos) ? data.minicursos.flatMap(item => item.timeline || []) : []),
    ...(Array.isArray(data.palestras) ? data.palestras.flatMap(item => item.timeline || []) : []),
  ];

  allEvents.forEach(event => {
    const date = event.date_init.split('T')[0];
    if (!organized[date]) {
      organized[date] = [];
    }
    organized[date].push({
      ...event,
      date_init: event.date_init
    });
  });

  Object.keys(organized).forEach(date => {
    organized[date].sort((a, b) => new Date(b.date_init).getTime() - new Date(a.date_init).getTime());
  });

  return organized;
}

const Modal = ({ handleModal, modal }) => {
  return (
    <div className="programacao-modal-overlay" onClick={handleModal}>
      <div className="programacao-modal" onClick={(e) => e.stopPropagation()}>
        <button className="programacao-modal-close" onClick={handleModal}>
          <X size={20} />
        </button>
        
        <div className="programacao-modal-content">
          <h2 className="programacao-modal-title">{modal.namePattern.toUpperCase()}</h2>
          
          <div className="programacao-modal-section">
            <h3 className="programacao-modal-section-title">
              <Info size={16} className="inline mr-2" />
              SOBRE
            </h3>
            <p className="programacao-modal-description">
              {modal.descriptionPattern}
            </p>
          </div>
          
          <div className="programacao-modal-section">
            <h3 className="programacao-modal-section-title">
              <Calendar size={16} className="inline mr-2" />
              PROGRAMAÇÃO
            </h3>
            <div className="programacao-timeline">
              {modal.timelinePattern.map((event, index) => {
                const data = new Date(event.date_init).toLocaleDateString()
                const time_init = new Date(event.date_init).toLocaleTimeString()
                const time_end = new Date(event.date_end).toLocaleTimeString()
                
                return (
                  <div className="programacao-timeline-item" key={index}>
                    <div className="programacao-timeline-event-name">
                      {event.name.toUpperCase()}
                    </div>
                    <div className="programacao-timeline-details">
                      <div className="programacao-timeline-detail">
                        <span className="programacao-timeline-detail-icon">🕐</span>
                        <span>{data.slice(0, 5)} - {time_init.slice(0, 5)} às {time_end.slice(0, 5)}</span>
                      </div>
                      <div className="programacao-timeline-detail">
                        <span className="programacao-timeline-detail-icon">📍</span>
                        <span>{event.local} - {event.local_description}</span>
                      </div>
                      <div className="programacao-timeline-detail">
                        <span className="programacao-timeline-detail-icon">⭐</span>
                        <span>{event.description}</span>
                      </div>
                    </div>
                    {index < modal.timelinePattern.length - 1 && (
                      <div className="programacao-timeline-divider"></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function padZeroIfNeeded(number) {
  return number < 10 ? '0' + number : number.toString();
}

const CardProgramacao = ({ dateKey, event, handleModal }) => {
  const DATE = new Date(dateKey + "T12:00:00-03:00")
  const daysNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const dayName = daysNames[DATE.getDay()]
  
  return (
    <div className="programacao-date-card">
      <div className="programacao-date-header">
        <h2 className="programacao-date-title">
          {DATE.toLocaleDateString().slice(0, 5)} - {dayName.toUpperCase()}
        </h2>
      </div>
      
      <div className="programacao-events-list">
        {event?.map((value, index) => {
          const dateInit = new Date(value.date_init).toLocaleTimeString()
          const dateEnd = new Date(value.date_end).toLocaleTimeString()

          return (
            <div 
              className="programacao-event-card" 
              onClick={() => handleModal(value)} 
              key={Math.floor(Math.random() * 100) * index}
            >
              <div className="programacao-event-indicator"></div>
              <div className="programacao-event-content">
                <div className="programacao-event-info">
                  <h3 className="programacao-event-title">
                    {value.name.toUpperCase()}
                  </h3>
                  <p className="programacao-event-description">
                    {value.description}
                  </p>
                  <div className="programacao-event-type">
                    <span className="programacao-event-type-icon">👩‍🎓</span>
                    <span>{value.namePattern.toUpperCase()}</span>
                  </div>
                </div>
                <div className="programacao-event-time">
                  <p>{dateInit}</p>
                  <p>às</p>
                  <p>{dateEnd}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}