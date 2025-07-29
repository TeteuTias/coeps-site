'use client'
import './style.css';

export default function Organizadores() {
  return (
    <main className="organizadores-main-gradient pt-20 lg:pt-24">
      {/* Seção principal */}
      <section className="glass-container w-full max-w-6xl mx-auto mt-8">
        <h1 className="letreiro-title">ORGANIZADORES</h1>
        
        {/* Container "Em breve" */}
        <div className="em-breve-container">
          <div className="em-breve-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
            </svg>
          </div>
          
          <h2 className="em-breve-title">EM BREVE</h2>
          
          <p className="em-breve-description">
            Estamos preparando uma seção especial para apresentar nossa equipe de organizadores.
            <br />
            Em breve você conhecerá todos os profissionais que fazem o COEPS acontecer!
          </p>
          
          <div className="em-breve-decoration">
            <div className="decoration-line"></div>
            <div className="decoration-dot"></div>
            <div className="decoration-line"></div>
          </div>
        </div>
      </section>

      {/* Seção de informações adicionais */}
      <section className="glass-container w-full max-w-6xl mx-auto mt-8">
        <h2 className="section-subtitle">SOBRE A ORGANIZAÇÃO</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3>Diretoria</h3>
            <p>Equipe dedicada à coordenação geral do evento</p>
          </div>
          <div className="info-card">
            <h3>Coordenadorias</h3>
            <p>Grupos especializados em diferentes áreas do congresso</p>
          </div>
          <div className="info-card">
            <h3>Colaboradores</h3>
            <p>Profissionais e estudantes que contribuem para o sucesso</p>
          </div>
        </div>
      </section>
    </main>
  );
} 