'use client'
import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import {
  Loader2,
  Clock,
  Info,
  FileText,
  Calendar,
  Users,
  Award,
  ExternalLink,
  Send
} from 'lucide-react';
import './style.css';

const Trabalhos = () => {
  const [config, setConfig] = useState<IAcademicWorksProps | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/inauthenticated/get/trabalhosConfig');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: IAcademicWorksProps = await response.json();
        setConfig(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <div className="trabalhos-main">
      {/* Header */}
      <section className="trabalhos-header">
        <div className="header-content">
          <h1 className="header-title">TRABALHOS</h1>
        </div>
      </section>

      {/* Seção de introdução */}
      <section className="glass-container trabalhos-intro">
        <h1 className="section-title">SUBMISSÃO DE TRABALHOS</h1>
        <p className="intro-text">
          O VII COEPS convida acadêmicos, profissionais da saúde e áreas afins a participarem
          da submissão de trabalhos inéditos. Esta é uma oportunidade única para compartilhar
          suas pesquisas e contribuir para o avanço da ciência na área da saúde.
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
              <h2 className="loading-text">CARREGANDO INFORMAÇÕES</h2>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : config?.isOpen ? (
            <div className="details-container">
              <div className="details-icon">
                <FileText className="info-icon" />
              </div>
              <h2 className="details-text">SUBMISSÕES ABERTAS</h2>
              <p className="details-subtext">As submissões de trabalhos estão abertas! Confira as informações abaixo.</p>
            </div>
          ) : (
            <div className="empty-container">
              <div className="empty-icon">
                <Clock className="clock-icon" />
              </div>
              <h2 className="empty-text">SUBMISSÕES EM BREVE</h2>
              <p className="empty-subtext">Ainda não definimos a data para a abertura das submissões. Fique atento às nossas atualizações!</p>
            </div>
          )}
        </div>
      </section>

      {/* Seção de cards de dados */}
      {!loading && config?.isOpen && (
        <section className="cards-section">
          <div className="cards-container">
            <div className="data-card glass-container">
              <div className="card-data">
                {config?.data_limite_submissao ?
                  new Date(config.data_limite_submissao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) :
                  '--/--'
                }
              </div>
              <div className="card-text">Limite de Submissão</div>
            </div>
            
            <div className="data-card glass-container">
              <div className="card-data">
                {config?.data_publicacao_resultados ?
                  new Date(config.data_publicacao_resultados).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) :
                  '--/--'
                }
              </div>
              <div className="card-text">Publicação de Resultados</div>
            </div>
          </div>
        </section>
      )}

      {/* Seção de publicações */}
      <section className="publications-section">
        <div className="publications-container">
          <h2 className="publications-title">PUBLICAÇÕES</h2>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner">
                <Loader2 className="spinner-icon" />
              </div>
              <h3 className="loading-text">CARREGANDO PUBLICAÇÕES</h3>
            </div>
          ) : config?.resultados && config.resultados.length > 0 ? (
            <div className="publications-list">
              {config.resultados.map((publication, index) => (
                <div key={index} className="publication-item glass-container">
                  <Link href={publication.link} target="_blank" className="publication-link">
                    <FileText className="publication-icon" />
                    {publication.titulo}
                    <ExternalLink size={16} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-container">
              <div className="empty-icon">
                <Award className="clock-icon" />
              </div>
              <h3 className="empty-text">NENHUMA PUBLICAÇÃO DISPONÍVEL</h3>
              <p className="empty-subtext">As publicações serão divulgadas em breve!</p>
            </div>
          )}
        </div>
      </section>

      {/* Seção de descrição */}
      <section className="description-section">
        <div className="description-container">
          <div className="description-text">
            {!loading && config?.isOpen ? (
              <>
                O Diretório Acadêmico Diogo Guimarães (DADG) do curso de graduação em Medicina do Centro Universitário IMEPAC Araguari apresenta o{' '}
                <span className="description-highlight">VII Congresso dos Estudantes e Profissionais de Saúde (COEPS)</span> que possui como tema
                &ldquo;O Novo Paradigma da Saúde: Burnout, Tecnologia e Ética&rdquo;. Com o intuito de incentivar a participação dos acadêmicos,
                profissionais da saúde e áreas afins em atividades de pesquisa, visando complementar a formação acadêmica e enriquecer conhecimentos,
                declara-se aberto o edital para a submissão de trabalhos inéditos pertinentes à área da saúde.
              </>
            ) : (
              <>
                O Diretório Acadêmico Diogo Guimarães (DADG) do curso de Medicina do Centro Universitário IMEPAC Araguari está preparando o{' '}
                <span className="description-highlight">VII Congresso dos Estudantes e Profissionais de Saúde (COEPS)</span>, com o tema
                &ldquo;Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional&rdquo;.{' '}
                <span className="description-highlight">Atualmente, o edital para a submissão de trabalhos inéditos ainda não está aberto</span>.
                No entanto, em breve, divulgaremos mais informações sobre como participar e submeter suas pesquisas. Fique atento ao nosso site
                e às nossas redes sociais para atualizações e detalhes sobre o processo de submissão.
              </>
            )}
          </div>
        </div>
      </section>

      {/* Seção de botões */}
      {!loading && config?.isOpen && (
        <section className="buttons-section">
          <div className="buttons-container">
            {config?.link_edital && (
              <Link href={config.link_edital} target="_blank">
                <button className="action-button">
                  <FileText size={20} style={{ marginRight: '8px' }} />
                  VER EDITAL
                </button>
              </Link>
            )}
            <Link href="/painel/trabalhos">
              <button className="action-button">
                <Send size={20} style={{ marginRight: '8px' }} />
                ENVIAR TRABALHO
              </button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Trabalhos;