'use client'
import { useEffect, useState } from "react";
import { ICourse, ILecture } from "@/lib/types/events/event.t";
import { Calendar, Clock, MapPin, Info, X, Loader2 } from 'lucide-react';
import './style.css';

export default function MinhaProgramacao() {
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [data, setData] = useState(undefined)
  const [modal, setModal] = useState(undefined)
  const [showRegrasModal, setShowRegrasModal] = useState<boolean>(true)

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

  // Travar scroll da página quando o modal estiver aberto
  useEffect(() => {
    if (showRegrasModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup: restaurar scroll quando componente desmontar
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showRegrasModal]);

  return (
    <div className="programacao-main">
      {modal && <Modal handleModal={() => handleModal(0)} modal={modal} />}
      {showRegrasModal && <RegrasModal onClose={() => setShowRegrasModal(false)} />}

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
              Clique nos cartões para ver mais informações sobre os eventos da sua agenda.
            </span>
          </p>
        </div>

        <div className="programacao-aviso-card">
          <h2 className="programacao-aviso-title">ATENÇÃO, AUTORES!</h2>
          <p className="programacao-aviso-subtitle">
            Informações importantes para as apresentações de trabalhos científicos:
          </p>

          <div className="programacao-aviso-section">
            <h3 className="programacao-aviso-section-title">
              Apresentação em formato de pôster / banner
            </h3>
            <ul className="programacao-aviso-list">
              <li>Serão realizadas no dia 14/11, no corredor do CEU.</li>
              <li>O autor principal ou coautor deverá expor o pôster durante todo o período, das 16h às 18h.</li>
            </ul>
          </div>

          <div className="programacao-aviso-section">
            <h3 className="programacao-aviso-section-title">
              Apresentação dos trabalhos em formato oral
            </h3>
            <ul className="programacao-aviso-list">
              <li>Serão realizadas no dia 15/11, no local e horário designados pela comissão científica.</li>
              <li>Apenas o <strong>autor principal</strong> poderá apresentar o trabalho.</li>
            </ul>
          </div>
        </div>
        {/*
        <div className="programacao-artigos-posters-container">
          <div className="programacao-artigos-card">
            <h2 className="programacao-artigos-posters-title">ARTIGOS</h2>
            <div className="programacao-artigos-table-container">
              <table className="programacao-artigos-table">
                <thead>
                  <tr>
                    <th>Nome do Autor</th>
                    <th>Nome do Artigo</th>
                    <th>Horário</th>
                    <th>Sala</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Aline Caroline Richter</td>
                    <td>Colecistectomia No Sistema Único De Saúde (2020-2024): Uma Análise De Tendências, Desfechos Clínicos, Disparidades Regionais E Custo-Efetividade</td>
                    <td>13:00</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Gabriel Alves Fernandes de Morais</td>
                    <td>Metabolismo Comparativo Do Etanol E Metanol: Rota Bioquímica E As Implicações Clínicas Na Intoxicação Por Ácido Fórmico – Uma Revisão Narrativa</td>
                    <td>13:00</td>
                    <td>Sala 38</td>
                  </tr>
                  <tr>
                    <td>Lucas Rodrigues Garcia</td>
                    <td>Evolução Dos Critérios Diagnósticos Da Doença De Alzheimer: Uma Revisão Sistemática Sobre O Impacto Dos Biomarcadores</td>
                    <td>13:00</td>
                    <td>Sala 39</td>
                  </tr>
                  <tr>
                    <td>Amanda Vaz Moura</td>
                    <td>Suplementos Nutricionais E Neuroproteção: Uma Revisão Integrativa</td>
                    <td>13:30</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Gianluca Zambiazi da Sá Rocha</td>
                    <td>Apendicite Aguda: Lições Das Diretrizes Internacionais E Perspectivas Para O Manejo No Brasil</td>
                    <td>13:30</td>
                    <td>Sala 39</td>
                  </tr>
                  <tr>
                    <td>Maria Júlia Mendes do Vale</td>
                    <td>O Impacto Da Poluição Ambiental Na Saúde Respiratória Infantil: Uma Revisão Narrativa</td>
                    <td>13:30</td>
                    <td>Sala 38</td>
                  </tr>
                  <tr>
                    <td>Ana Júlia Rausis Gontijo</td>
                    <td>O Papel Da Tecnologia No Acompanhamento Longitudinal Do Paciente Na Atenção Primária: Entre A Humanização E A Automação</td>
                    <td>14:00</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Maria Eduarda Ribeiro dos Santos</td>
                    <td>Tecnologia, Saúde Mental E Burnout: Impactos Da Hiperconexão No Trabalho Contemporâneo</td>
                    <td>14:00</td>
                    <td>Sala 39</td>
                  </tr>
                  <tr>
                    <td>Ana Luiza Mantovani Rodrigues</td>
                    <td>Herpes Zóster Oftálmico: Manifestações Oculares, Complicações E Abordagem Atual</td>
                    <td>14:30</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Giovanna Godói Martins de Araújo</td>
                    <td>A Síndrome De Burnout Na Formação Médica: Uma Revisão Narrativa Da Literatura</td>
                    <td>14:30</td>
                    <td>Sala 38</td>
                  </tr>
                  <tr>
                    <td>Giulia Amaral Silva</td>
                    <td>O Papel Dos Micronutrientes Na Modulação Do Estresse E Da Saúde Mental Em Adultos: Uma Revisão Integrativa</td>
                    <td>14:30</td>
                    <td>Sala 39</td>
                  </tr>
                  <tr>
                    <td>Carlos Eduardo Peixoto</td>
                    <td>Tuberculose Em Minas Gerais: Distribuição Temporal, Fatores Sociais E Desafios Para O Controle (2014–2024)</td>
                    <td>15:00</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Giovanna Resende De Oliveira</td>
                    <td>Síndrome De Cushing Exógena Associada Ao Uso De Suplemento Nutricional Com Provável Efeito Corticoide-Like: Relato De Caso</td>
                    <td>15:00</td>
                    <td>Sala 38</td>
                  </tr>
                  <tr>
                    <td>Ellen Vanessa Soares Pereira</td>
                    <td>Hernioplastia Diafragmática No SUS: Comparação Entre Vias Abdominal E Torácica Quanto A Desfechos Clínicos E Custo-Efetividade (2020–2024)</td>
                    <td>15:30</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Ícaro Leal Clemente Lemes</td>
                    <td>Revisão Sistemática E Meta-Análise: Efeito Da Suplementação De Whey Protein E Exercício Resistido No Tratamento Da Sarcopenia Em Idosos</td>
                    <td>15:30</td>
                    <td>Sala 38</td>
                  </tr>
                  <tr>
                    <td>Matheus Messias Diolino</td>
                    <td>Cobertura Vacinal Contra O HPV Em Araguari: Análise Comparativa Da Macrorregião De Saúde Triângulo Norte, Estado De Minas Gerais, Município De Araguari E Brasil (2014–2024)</td>
                    <td>15:30</td>
                    <td>Sala 39</td>
                  </tr>
                  <tr>
                    <td>Ellen Vanessa Soares Pereira</td>
                    <td>Comparação Entre Apendicectomia Videolaparoscópica E Aberta No SUS: Tempo De Internação, Custo Médio E Mortalidade</td>
                    <td>16:00</td>
                    <td>Sala 37</td>
                  </tr>
                  <tr>
                    <td>Julia Silva Pereira Santos</td>
                    <td>Ozempic® Além Da Balança: Implicações Do Uso De Agonistas Do GLP-1 No Tratamento Da Obesidade E Diabetes Mellitus (DM)</td>
                    <td>16:00</td>
                    <td>Sala 39</td>
                  </tr>
                  <tr>
                    <td>Lorene Alarcão Viza</td>
                    <td>Telemedicina E Inteligência Artificial: Efeitos Sobre O Burnout Médico – Revisão Da Literatura</td>
                    <td>16:00</td>
                    <td>Sala 38</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="programacao-posters-card">
            <h2 className="programacao-artigos-posters-title">POSTERS</h2>
            <div className="programacao-posters-table-container">
              <table className="programacao-posters-table">
                <thead>
                  <tr>
                    <th>Nome do Autor</th>
                    <th>Nome do Poster</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Ana Beatriz Reis Aratjo</td>
                    <td>PERFIL EPIDEMIOLOGICO DA TUBERCULOSE EM PESSOAS PRIVADAS DE LIBERDADE NO TRIANGULO MINEIRO (2012-2022)</td>
                  </tr>
                  <tr>
                    <td>Ana Cecilia de Queiroz</td>
                    <td>Copenhagen Burnout Inventory: Um Instrumento Essencial na Avaliagio da Sindrome de Burnout em Profissionais da Satide</td>
                  </tr>
                  <tr>
                    <td>Ana Cristina Nunes Franco</td>
                    <td>O PESO DO SENTIR: A EXAUSTAO EMPATICA E O BURNOUT NA FORMACAO MEDICA.</td>
                  </tr>
                  <tr>
                    <td>Ana Flavia Elias Kopke</td>
                    <td>A SINDROME DO INTESTINO IRRITAVEL ASSOCIADA A FATORES PSICOEMOCIONAIS EM UM AMBULATORIO NO MUNICIPIO DE ARAGUARI: UM ESTUDO QUANTITATIVO</td>
                  </tr>
                  <tr>
                    <td>Ana Flavia Elias Kopke</td>
                    <td>DIAGNOSTICO TARDIO DE MONONUCLEOSE INFECCIOSA APOS MULTIPLAS CONDUTAS TATROGENICAS: UM RELATO DE CASO</td>
                  </tr>
                  <tr>
                    <td>Ana Jilia Guerra Mansano</td>
                    <td>CRISE CONVULSIVA FEBRIL PROLONGADA NA POPULAGAO PEDIATRICA: REVISAO DE LITERATURA</td>
                  </tr>
                  <tr>
                    <td>Ana Julia Guerra Mansano</td>
                    <td>BRADICARDIA ASSINTOMATICA NA DENGUE PEDIATRICA: FISIOPATOLOGIA, IMPLICACOES CLINICAS E CONDUTAS - UMA REVISAO NARRATIVA</td>
                  </tr>
                  <tr>
                    <td>Barbara Drigo Peixoto</td>
                    <td>ABANDONO DO TRATAMENTO DE TUBERCULOSE NA POPULACAO EM SITUACAO DE RUA: UM ESTUDO DO PERFIL EPIDEMIOLOGICO REGISTRADOS ENTRE 2019 A 2023</td>
                  </tr>
                  <tr>
                    <td>Brenda Soares Ribeiro</td>
                    <td>BURNOUT DIGITAL: A INFLUENCIA DA HIPERCONECTIVIDADE E DOS SISTEMAS ELETRONICOS NA SAUDE DO MEDICO</td>
                  </tr>
                  <tr>
                    <td>Daniela Batista Rezende</td>
                    <td>EXERCICIO FiSICO E SEUS IMPACTOS SOBRE A DEPRESSAO</td>
                  </tr>
                  <tr>
                    <td>Daniela Batista Rezende</td>
                    <td>A ETIOPATOGENIA DA ALERGIA A PROTEINA DO LEITE DE VACA (APLV): UMA REVISAO DA LITERATURA.</td>
                  </tr>
                  <tr>
                    <td>Emilly de Sousa Matos</td>
                    <td>IMPRESSAO 3D EM CIRURGIAS COMPLEXAS E RECONSTRUTIVAS: REVISAO INTEGRATIVA</td>
                  </tr>
                  <tr>
                    <td>Emilly Vargas Caetano</td>
                    <td>A INFLUENCIA DAS REDES SOCIAIS NA RELAGAO MEDICO-PACIENTE</td>
                  </tr>
                  <tr>
                    <td>Francielle Silva de Oliveira</td>
                    <td>A RECUSA DE VACINAÇÃO INFANTIL COMO DESAFIO ÉTICO PARA A PRÁTICA PEDIÁTRICA</td>
                  </tr>
                  <tr>
                    <td>Francielle Silva de Oliveira</td>
                    <td>USO DE TELAS NA INFANCIA</td>
                  </tr>
                  <tr>
                    <td>Gabriel Assunção Alvim</td>
                    <td>Morfina Oral versus Oxicodona Oral no Manejo Ambulatorial da Dor Oncológica: Eficácia, Segurança e Manutenção do Tratamento</td>
                  </tr>
                  <tr>
                    <td>Gabriel Assunção Alvim</td>
                    <td>Eficácia da Dexmedetomidina em Comparação ao Midazolam para Sedação em Procedimentos Cirúrgicos Ambulatoriais: Uma Revisão Sistemática</td>
                  </tr>
                  <tr>
                    <td>Gabriel Santos Alves</td>
                    <td>HISTÓRIAS SOCIAIS EM CRIANÇAS COM TRANSTORNO DO ESPECTRO AUTISTA: REVISÃO DE LITERATURA SOBRE INTERVENÇÕES PARA HABILIDADES SOCIAIS</td>
                  </tr>
                  <tr>
                    <td>Gabriela Teixeira de Araújo</td>
                    <td>MAPEAMENTO DAS AÇÕES REALIZADAS PELO PROJETO DE EXTENSÃO &quot;DOCE LAR&quot; EM UM SERVIÇO DE ACOLHIMENTO INSTITUCIONAL (2024-2025)</td>
                  </tr>
                  <tr>
                    <td>Giovanna Amaral de Paula Lemos Freire</td>
                    <td>A BOA MORTE SOB A ÓTICA DA BIOÉTICA: AUTONOMIA, DIGNIDADE E CUIDADO NO FIM DA VIDA</td>
                  </tr>
                  <tr>
                    <td>Giovanna Amaral de Paula Lemos Freire</td>
                    <td>IMPACTOS NEGATIVOS DA DISLEXIA NO DESENVOLVIMENTO EMOCIONAL E COGNITIVO</td>
                  </tr>
                  <tr>
                    <td>Isabella Resende e Oliveira</td>
                    <td>A INFLUÊNCIA DA ESPIRITUALIDADE NOS CUIDADOS PALIATIVOS E BEM ESTAR DE PACIENTES ONCOLÓGICOS</td>
                  </tr>
                  <tr>
                    <td>Isadora Cangussu Souza</td>
                    <td>ÓBITOS MATERNOS POR CAUSAS OBSTÉTRICAS DIRETAS NO BRASIL</td>
                  </tr>
                  <tr>
                    <td>João Victor do Nascimento</td>
                    <td>APLICAÇÃO DA INTELIGÊNCIA ARTIFICIAL NA MEDICINA DE PRECISÃO</td>
                  </tr>
                  <tr>
                    <td>Karla Gabriella Rodrigues do Nascimento</td>
                    <td>LASER DE BAIXA INTENSIDADE NO TRATAMENTO FISIOTERAPÊUTICO DA PARALISIA FACIAL EM CRIANÇA: RELATO DE CASO</td>
                  </tr>
                  <tr>
                    <td>Laura Moreira de Melo</td>
                    <td>O SONO PERDIDO: IMPACTO DE DISTURBIOS DO SONO NA SAUDE MENTAL E DESEMPENHO ACADEMICO DE ESTUDANTES DE MEDICINA</td>
                  </tr>
                  <tr>
                    <td>Layla Paola Resende Couto</td>
                    <td>EXERCICIOS DE PEITORAL NA MUSCULACAO PARA MULHERES COM PROTESE MAMARIA: UMA REVISAO NARRATIVA</td>
                  </tr>
                  <tr>
                    <td>Layla Paola Resende Couto</td>
                    <td>EFICACIA DE ESTRATEGIAS PARA PREVENCAO DE TROMBOSE VENOSA PROFUNDA EM GRANDES CIRURGIAS</td>
                  </tr>
                  <tr>
                    <td>Luisa Almeida Barbosa</td>
                    <td>SINDROME DE TURNER DIAGNOSTICADA NA QUARTA DECADA DE VIDA: IMPORTANCIA DA INVESTIGACAO DE AMENORREIA PRIMARIA</td>
                  </tr>
                  <tr>
                    <td>Luisa Clemente Lopes</td>
                    <td>A INFLUENCIA DAS MIDIAS SOCIAIS NA DEPRESSAO, ANSIEDADE E SOFRIMENTO PSIQUICO EM ADOLESCENTES</td>
                  </tr>
                  <tr>
                    <td>Manuela Muniz Freitas da Fonseca Tavares</td>
                    <td>TECNOLOGIAS DIGITAIS, CARGA DE TRABALHO E BURNOUT EM PROFISSIONAIS DE SAUDE: UMA REVISAO NARRATIVA.</td>
                  </tr>
                  <tr>
                    <td>Maria Clara Zacharias Salomao</td>
                    <td>DESIGUALDADES NO TEMPO DE INICIO DO TRATAMENTO DO CANCER DE PROSTATA: UM ESTUDO EPIDEMIOLOGICO</td>
                  </tr>
                  <tr>
                    <td>Maria Clara Zacharias Salomao</td>
                    <td>CARACTERIZACAO DOS CASOS DE NEGLIGENCIA/ABANDONO EM CRIANCAS E ADOLESCENTES NO BRASIL: ANALISE DAS NOTIFICACOES DE 2019 A 2023</td>
                  </tr>
                  <tr>
                    <td>Maria Eduarda Marcolino Bizoni Carvalho</td>
                    <td>O SORRISO DA GENETICA: ENTENDENDO A SINDROME DE ANGELMAN</td>
                  </tr>
                  <tr>
                    <td>Maria Eduarda Martins da Costa Viana</td>
                    <td>REEMERGENCIA DO SARAMPO NO BRASIL: REVISAO DE LITERATURA SOBRE CASOS IMPORTADOS E SURTOS REGIONAIS</td>
                  </tr>
                  <tr>
                    <td>Maria Luiza Cassiano Barboza Silva</td>
                    <td>IMPACTO DO USO EXCESSIVO DE TELAS NA QUALIDADE DO SONO DE CRIANCAS E ADOLESCENTES</td>
                  </tr>
                  <tr>
                    <td>Mateus Souza Alvarez</td>
                    <td>Aspectos Determinantes para o Retorno Esportivo apos Reconstrucao do Ligamento Cruzado Anterior</td>
                  </tr>
                  <tr>
                    <td>Melissa Bernardes Rangel</td>
                    <td>EFEITOS PSICOSSOCIAIS DOS TRANSTORNOS ALIMENTARES EM ESTUDANTES UNIVERSITARIOS: RESUMO SIMPLES</td>
                  </tr>
                  <tr>
                    <td>Natally Guedes Martins</td>
                    <td>ESPONDILODISCITE: UM RELATO DE CASO</td>
                  </tr>
                  <tr>
                    <td>Raissa Regina Correa Silva</td>
                    <td>FEBRE DE ORIGEM DESCONHECIDA: UMA REVISAO SOBRE CRITERIOS DIAGNOSTICOS, ETIOLOGIAS E O PAPEL DA IMAGEM MOLECULAR</td>
                  </tr>
                  <tr>
                    <td>Sabrina Pedrosa Siqueira Rios</td>
                    <td>Condicoes Clinicas, Comorbidades e Desfechos da Tuberculose em Pessoas Privadas de Liberdade no Triangulo Mineiro (2012–2022)</td>
                  </tr>
                  <tr>
                    <td>Silvio Andre Pereira Mundim</td>
                    <td>Avaliacao e Abordagem Multimodal da Dor na Crianca e no Adolescente: Uma Sintese Baseada em Diretrizes Pediatricas</td>
                  </tr>
                  <tr>
                    <td>Taissa Oliveira Ferreira Castro</td>
                    <td>A OBJECAO DE CONSCIENCIA COMO EXPRESSAO DA AUTONOMIA PROFISSIONAL NA PRATICA MEDICA</td>
                  </tr>
                  <tr>
                    <td>Taissa Oliveira Ferreira Castro</td>
                    <td>A VIOLENCIA OBSTETRICA COMO REFLEXO DE LACUNAS ETICAS E ESTRUTURAIS NA ASSISTENCIA AO PARTO</td>
                  </tr>
                  <tr>
                    <td>Veronca Custodio da Silva</td>
                    <td>BURNOUT E DESUMANIZACAO DA PRATICA MEDICA DURANTE A GRADUACAO: UMA REVISAO INTEGRATIVA DA LITERATURA</td>
                  </tr>
                  <tr>
                    <td>Veronica Custodio da Silva</td>
                    <td>INTELIGENCIA ARTIFICIAL NO DIAGNOSTICO MEDICO: UMA REVISAO INTEGRATIVA DA ACURACIA E APLICABILIDADE CLINICA</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
    */}
        <div className="programacao-cards-container">
          {isFetching ? (
            <div className="programacao-loading">
              <h1>CARREGANDO</h1>
              <div className="programacao-loading-animation"></div>
            </div>
          ) : Object.keys(data?.data).length ? (
            Object.keys(data?.data)
              //@ts-expect-error: Essa página deveria ser tipada de forma mais concisa. Não há erro aqui, mas como não foi tipado, o TS vai falar que deveríamos especificar melhor o tipo de A e B.
              .sort((a, b) => new Date(a) - new Date(b))
              .map(key => {
                console.log(key)
                return (
                  <CardProgramacao
                    dateKey={key}
                    event={data?.data[key]}
                    key={Math.floor(Math.random() * 100)}
                    handleModal={handleModal}
                  />
                )
              })
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
    organized[date].sort((a, b) => new Date(a.date_init).getTime() - new Date(b.date_init).getTime());
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

const RegrasModal = ({ onClose }) => {
  return (
    <div className="regras-modal-overlay">
      <div className="regras-modal">
        <div className="regras-modal-content">
          <h2 className="regras-modal-title">REGRAS DE CONDUTA</h2>

          <div className="regras-modal-text">
            <p className="regras-modal-intro">
              Para manter a ordem e a organização do evento as seguintes regras devem ser rigorosamente seguidas:
            </p>

            <div className="regras-modal-section">
              <h3 className="regras-modal-section-title">1. Identificação e acesso</h3>
              <p className="regras-modal-section-text">
                Todos os participantes, palestrantes e demais envolvidos no minicurso, devem assinar a lista de presença durante o evento, somente pessoas previamente inscritas e com nome na lista terão acesso à área do minicurso.
              </p>
            </div>

            <div className="regras-modal-section">
              <h3 className="regras-modal-section-title">2. Proibição de Adornos</h3>
              <p className="regras-modal-section-text">
                Nos minicursos práticos que contarão com manequins e materiais disponibilizados pela comissão organizadora, não será permitido o uso de adornos (colares, brincos, pulseiras, anéis e relógios) por parte dos membros da liga, professores e congressistas. Ressaltamos que é obrigatório manter a integridade dos materiais fornecidos durante o evento.
              </p>
            </div>

            <div className="regras-modal-section">
              <h3 className="regras-modal-section-title">3. Papelaria</h3>
              <p className="regras-modal-section-text">
                Não será permitida a entrada na área do minicurso com canetas, lápis ou quaisquer outros materiais próprios que possam danificar ou comprometer a integridade dos manequins e demais recursos disponibilizados pela comissão organizadora.
              </p>
            </div>

            <div className="regras-modal-section">
              <h3 className="regras-modal-section-title">4. Vestimenta</h3>
              <p className="regras-modal-section-text">
                É importante que os participantes das ligas, professores e congressistas utilizem roupas adequadas, sapatos fechados e estejam portando o crachá de identificação do CIEPS. Nos minicursos realizados em laboratórios, é obrigatório o uso de jaleco, visando a segurança e o cumprimento das normas institucionais.
              </p>
              <p className="regras-modal-section-text">
                Os manequins ou estruturas disponibilizadas pelo CSR devem ser manipulados com cautela e utilizando luvas para que não ocorra nenhuma intercorrência.
              </p>
            </div>

            <div className="regras-modal-warning">
              <p className="regras-modal-warning-text">
                Qualquer pessoa envolvida no minicurso que transgredir as normas estipuladas ou apresentar relutância em adequar-se às condutas preconizadas será convidada a se retirar do evento sem direito a certificação.
              </p>
            </div>
          </div>

          <button className="regras-modal-button" onClick={onClose}>
            ENTENDI
          </button>
        </div>
      </div>
    </div>
  )
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
