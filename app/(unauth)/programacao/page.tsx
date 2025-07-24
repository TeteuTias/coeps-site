'use client'
import React, { useState, useEffect } from 'react';
import Waves from '@/app/components/Waves';
import { ILecture, ICourse } from '@/lib/types/events/event.t';
import {
  Calendar,
  Users,
  GraduationCap,
  Music,
  Microscope,
  Heart,
  BookOpen,
  Trophy,
  Star,
  Lightbulb,
  Target,
  Activity,
  ChevronDown,
  ChevronUp,
  Presentation,
  FlaskConical,
  Stethoscope,
  Award,
  Gamepad2,
  Brain,
  Sparkles,
  Loader2,
  Clock,
  Info
} from 'lucide-react';
import './style.css';

const App = () => {
  const [data, setData] = useState<null | { course: ICourse[]; lecture: ILecture[] }>(null);
  const [loading, setLoading] = useState(1);
  const [organizedData, setOrganizedData] = useState<{ [key: string]: Array<ICourse | ILecture> }>({});
  const [showModal, setShowModal] = useState<any>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<{ [key: string]: boolean }>({});

  const openModal = (timeline: any) => setShowModal(timeline);
    const closeModal = () => setShowModal(false);

  const toggleCategory = (categoryName: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/inauthenticated/get/programacao', { cache: 'no-store' });
        const result: { result1: ICourse[]; result2: ILecture[] } = await response.json();
                setData({
                    course: result.result1,
                    lecture: result.result2
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (data) {
            setOrganizedData(organizeData(data));
      setLoading(0);
        }
    }, [data]);

  function organizeData(data: { course: ICourse[]; lecture: ILecture[] }) {
        const combinedResults = [...data.course, ...data.lecture];
    const organized: { [key: string]: Array<ICourse | ILecture> } = {};
    combinedResults.forEach(item => {
            if (!organized[item.type]) {
                organized[item.type] = [];
            }
      organized[item.type].push(item);
    });
    return organized;
  }

  const getEventIcon = (eventType: string) => {
    const type = eventType.toLowerCase();
    if (type.includes('palestra') || type.includes('conferência') || type.includes('apresentação')) return <Presentation size={24} />;
    if (type.includes('minicurso') || type.includes('workshop') || type.includes('curso')) return <GraduationCap size={24} />;
    if (type.includes('festa') || type.includes('social') || type.includes('confraternização')) return <Music size={24} />;
    if (type.includes('pesquisa') || type.includes('científico') || type.includes('estudo')) return <FlaskConical size={24} />;
    if (type.includes('saúde') || type.includes('médico') || type.includes('clínico')) return <Stethoscope size={24} />;
    if (type.includes('trabalho') || type.includes('artigo') || type.includes('publicação')) return <BookOpen size={24} />;
    if (type.includes('competição') || type.includes('premiação') || type.includes('concurso')) return <Award size={24} />;
    if (type.includes('atividade') || type.includes('vivência') || type.includes('experiência')) return <Activity size={24} />;
    if (type.includes('todos') || type.includes('geral') || type.includes('completo')) return <Sparkles size={24} />;
    if (type.includes('objetivo') || type.includes('meta') || type.includes('foco')) return <Target size={24} />;
    if (type.includes('participante') || type.includes('grupo') || type.includes('equipe')) return <Users size={24} />;
    if (type.includes('inovação') || type.includes('tecnologia') || type.includes('moderno')) return <Brain size={24} />;
    if (type.includes('jogo') || type.includes('lúdico') || type.includes('interativo')) return <Gamepad2 size={24} />;
    return <Calendar size={24} />;
  };

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('palestra') || name.includes('conferência')) return <Presentation size={20} />;
    if (name.includes('minicurso') || name.includes('workshop')) return <GraduationCap size={20} />;
    if (name.includes('festa') || name.includes('social')) return <Music size={20} />;
    if (name.includes('pesquisa') || name.includes('científico')) return <FlaskConical size={20} />;
    if (name.includes('saúde') || name.includes('médico')) return <Stethoscope size={20} />;
    if (name.includes('trabalho') || name.includes('artigo')) return <BookOpen size={20} />;
    if (name.includes('competição') || name.includes('premiação')) return <Award size={20} />;
    if (name.includes('atividade') || name.includes('vivência')) return <Activity size={20} />;
    if (name.includes('todos') || name.includes('geral')) return <Sparkles size={20} />;
    if (name.includes('objetivo') || name.includes('meta')) return <Target size={20} />;
    if (name.includes('participante') || name.includes('grupo')) return <Users size={20} />;
    if (name.includes('inovação') || name.includes('tecnologia')) return <Brain size={20} />;
    if (name.includes('jogo') || name.includes('lúdico')) return <Gamepad2 size={20} />;
    return <Star size={20} />;
  };

    return (
    <div className="programacao-main">
            <Modal show={showModal} onClose={closeModal} />

      {/* Header com imagem de fundo */}
      <section className="programacao-header">
        <div className="header-content">
          <h1 className="header-title">PROGRAMAÇÃO</h1>
                </div>
      </section>

      {/* Seção de introdução */}
      <section className="glass-container programacao-intro">
        <h1 className="section-title">NOSSA PROGRAMAÇÃO</h1>
        <p className="intro-text">
          O VII COEPS contará com uma extensa programação durante os 04 dias de eventos, sendo todas as atividades presencialmente de 13 a 16 de novembro de 2024.
          Teremos palestras, minicursos, atividades político culturais, vivências e visita técnicas, apresentação de trabalhos,
          entre outras, buscando fornecer diferentes possibilidades ao aluno participante. Fique ligado no site e em nossos
          meios de comunicação oficiais!
          <span className="highlight-text">Clique nos títulos para expandir/recolher as categorias.</span>
        </p>
      </section>

      {/* Seção de status */}
      <section className="status-section">
        <div className="status-container glass-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner">
                <Loader2 className="spinner-icon" />
              </div>
              <h2 className="loading-text">CARREGANDO PROGRAMAÇÃO</h2>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : Object.keys(organizedData).length > 0 ? (
            <div className="details-container">
              <div className="details-icon">
                <Info className="info-icon" />
              </div>
              <h2 className="details-text">CLIQUE PARA OBTER MAIS DETALHES</h2>
              <p className="details-subtext">Explore nossa programação completa clicando nas categorias abaixo</p>
            </div>
          ) : (
            <div className="empty-container">
              <div className="empty-icon">
                <Clock className="clock-icon" />
              </div>
              <h2 className="empty-text">AINDA NÃO TEMOS UM CRONOGRAMA DE EVENTOS</h2>
              <p className="empty-subtext">Estamos trabalhando para trazer a melhor programação para você!</p>
            </div>
          )}
            </div>
      </section>

      {/* Seção de eventos */}
      <section className="events-section">
        <div className="events-container">
          {!loading && Object.keys(organizedData).length > 0 ? (
            <div className="events-grid">
              {Object.keys(organizedData).map((eventType, index) => (
                <div className={`event-category${collapsedCategories[eventType] ? ' collapsed' : ''}`} key={index}>
                  <div 
                    className="category-header glass-container"
                    onClick={() => toggleCategory(eventType)}
                  >
                    <div className="category-title-container">
                      <div className="category-icon">
                        {getCategoryIcon(eventType)}
                </div>
                      <h3 className="category-title">
                        {eventType.toUpperCase() === "TODOS"
                          ? eventType.toUpperCase()
                          : eventType.toUpperCase() + "S"}
                      </h3>
                    </div>
                    <div className="category-toggle">
                      {collapsedCategories[eventType] ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
            </div>
                  {!collapsedCategories[eventType] && (
                    <div className="events-list-bg">
                      <div className="events-list">
                        {organizedData[eventType].map(event => {
                          const color = generateHexColor();
                                    return (
                            <div 
                              key={event._id} 
                              className="event-card glass-container"
                              style={{ 
                                background: `linear-gradient(135deg, ${color}dd 0, ${color}bb 100%)`,
                                border: `1px solid ${color}88`
                              }}
                              onClick={() => openModal(event)}
                            >
                              <div className="event-icon">
                                {getEventIcon(event.type)}
                              </div>
                              <div className="event-info">
                                <h4 className="event-name">{event.name}</h4>
                                <div className="event-time">
                                  <p>{new Date(event.timeline[0].date_init).toLocaleString()} às</p>
                                  <p>{new Date(event.timeline[0].date_end).toLocaleString()}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                          );
                        })}
                        </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !loading && Object.keys(organizedData).length === 0 ? (
            <div className="empty-state">
              <h2 className="empty-text">
                Mas não se preocupe! Estamos trabalhando muuuito para isso! Fique ligado nas novidades!
              </h2>
            </div>
          ) : null}
        </div>
      </section>
        </div>
    );
};

const Modal = ({ show, onClose }: { show: any; onClose: () => void }) => {
  if (!show) return null;

    return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-container">
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
          <h2 className="modal-title">{show.name.toUpperCase()}</h2>
        </div>
        <div className="modal-content">
          <div className="modal-waves">
            <Waves2 />
          </div>
          <div className="modal-section">
            <h3 className="modal-section-title">SOBRE O EVENTO</h3>
            <p className="modal-description">{show.description}</p>
          </div>
          <div className="modal-section">
            <h3 className="modal-section-title">AGENDA DO EVENTO</h3>
            <div className="timeline-container">
              {show.timeline.map((timeline: any) => {
                const dataInicio = new Date(timeline.date_init);
                const dataFim = new Date(timeline.date_end);
                return (
                  <div key={timeline._id} className="timeline-item">
                    <div className="timeline-date">
                      <h4>{dataInicio.toLocaleDateString()}</h4>
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-details">
                        <div className="timeline-detail">
                          <h5>{timeline.name}</h5>
                        </div>
                        <div className="timeline-detail">
                          <p>{timeline.description}</p>
                        </div>
                        <div className="timeline-detail">
                          <p>📍 {timeline.local} <span>{timeline.local_description}</span></p>
                        </div>
                        <div className="timeline-detail">
                          <p>🕐 {dataInicio.toLocaleTimeString()} às {dataFim.toLocaleTimeString()}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                );
              })}
                                </div>
                            </div>
                </div>
            </div>
        </div>
    );
};

const Waves2 = () => (
  <div className="waves-container">
    <svg
      className="waves-svg"
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
                    <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7)" />
                    <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />
                    <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />
                    <use xlinkHref="#gentle-wave" x="48" y="7" fill="#fff" />
                </g>
            </svg>
        </div>
    );

function generateHexColor() {
    let color;
    do {
        color = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    } while (isTooCloseToWhite(color));
    return `#${color}`;
}

function isTooCloseToWhite(hex: string) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
  return r > 200 && g > 200 && b > 200;
}

export default App;
