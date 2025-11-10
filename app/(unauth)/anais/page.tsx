'use client'
import React, { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { IConferenceProceedings } from "@/lib/types/conferenceProceedings/conferenceProceedings.t";
import {
  Loader2,
  BookOpen,
  Info,
  FileText,
  Mail,
  Phone,
  Instagram,
  ExternalLink
} from 'lucide-react';
import './style.css';

const Anais = () => {
  const [anais, setAnais] = useState<null | IConferenceProceedings[]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/inauthenticated/get/anais');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: { data: IConferenceProceedings[] } = await response.json();
        
        // Ordenar a lista com base em date_update
        const sortedData = data.data.sort((a, b) =>
          new Date(a.date_update).getTime() - new Date(b.date_update).getTime()
        );
        setAnais(sortedData);
      } catch (error) {
        setError(error.message);
      } finally {
          setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <div className="anais-main">
      {/* Header */}
      <section className="anais-header">
        <div className="header-content">
          <h1 className="header-title">ANAIS</h1>
        </div>
      </section>

      {/* Seção de introdução */}
      <section className="glass-container anais-intro">
        <h1 className="section-title">O QUE TEMOS AQUI</h1>
        <p className="intro-text">
          Aqui você encontra todas as publicações pertinentes aos Anais de Congresso, 
          tanto do ano atual, quanto também de congressos passados. Fique ligado nas 
          novidades e acompanhe as publicações científicas do COEPS!
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
              <h2 className="loading-text">CARREGANDO ANAIS</h2>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : anais && anais.length > 0 ? (
            <div className="details-container">
              <div className="details-icon">
                <BookOpen className="info-icon" />
              </div>
              <h2 className="details-text">ANAIS DISPONÍVEIS</h2>
              <p className="details-subtext">Confira todas as publicações científicas do COEPS abaixo!</p>
            </div>
          ) : (
            <div className="empty-container">
              <div className="empty-icon">
                <BookOpen className="book-icon" />
          </div>
              <h2 className="empty-text">AINDA NÃO HÁ PUBLICAÇÕES</h2>
              <p className="empty-subtext">Os anais serão publicados em breve! Fique atento às nossas atualizações.</p>
            </div>
          )}
          </div>
      </section>

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
          ) : anais && anais.length > 0 ? (
            <div className="publications-grid">
              {anais.map((anaisItem, index) => (
                <CardAnais 
                  key={index}
                  link={anaisItem.link} 
                  url="/anais01.png" 
                  titulo={anaisItem.name} 
                  ano={new Date(anaisItem.date_update).getFullYear()} 
                />
              ))}
            </div>
          ) : (
            <div className="empty-container">
              <div className="empty-icon">
                <FileText className="book-icon" />
              </div>
              <h3 className="empty-text">NENHUMA PUBLICAÇÃO DISPONÍVEL</h3>
              <p className="empty-subtext">As publicações serão divulgadas em breve!</p>
            </div>
          )}
        </div>
      </section>

      {/* Seção de contato */}
      <section className="contact-section">
        <div className="contact-container">
          <h2 className="contact-title">CONTATO</h2>
          <div className="contact-info">
            <div className="contact-item">
              <Mail className="contact-icon" />
              <span>dadg.imepac@gmail.com</span>
            </div>
            <div className="contact-item">
              <Phone className="contact-icon" />
              <span>+55 34 99120-9359</span>
            </div>
            <div className="contact-item">
              <Instagram className="contact-icon" />
              <span>@coeps.araguari</span>
            </div>
          </div>
        </div>
      </section>
        </div>
  );
};

// Componente Card de Anais
function CardAnais({ url, titulo, ano, link }: { url: string; titulo: string; ano: number; link: string }) {
  return (
    <Link href={link} target="_blank" className="anais-card glass-container">
      <div className="anais-image">
        <Image
          src={url}
          width={220}
          height={180}
          alt={`${titulo} - ${ano}`}
          style={{ width: '100%', height: 'auto', borderRadius: '12px' }}
        />
      </div>
      <div className="anais-title">{titulo}</div>
      <div className="anais-year">{ano}</div>
    </Link>
  );
}

export default Anais;