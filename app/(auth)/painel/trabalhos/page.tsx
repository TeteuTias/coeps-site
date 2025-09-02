'use client'
import { upload } from '@vercel/blob/client';

// pages/index.js
import { useEffect, useState } from 'react';
import CardDatas from '@/app/components/CardDatas';
import WarningModal from '@/app/components/WarningModal';
import { isTodayBetweenDates } from '@/lib/isTodayBetweenDates';
import { IAcademicWorksProps, IAcademicWorks } from '@/lib/types/academicWorks/academicWorks.t';
import { useRouter } from 'next/navigation';
import {
    FileText,
    User,
    CheckCircle,
    XCircle,
    Eye,
    Calendar,
    Layers,
    Link,
    Tag,
    MessageCircle,
    File,
    MessageSquare,
} from 'lucide-react'
import './style.css';

//
//
export default function Home() {
    const [usuarioTrabalhos, setUsuarioTrabalhos] = useState<IAcademicWorks[]>()
    const [trabalhosConfigs, setTrabalhosConfigs] = useState<IAcademicWorksProps>()
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const router = useRouter()

    // carregando data
    useEffect(() => {
        const fetchData = async () => {
            //console.log("executou")
            const [response1, response2] = await Promise.all([
                fetch('/api/get/trabalhosConfig', { cache: 'no-cache' }).then(value => value.json()),
                fetch('/api/get/usuariosTrabalhos', { cache: 'no-cache' }).then(value => value.json())
            ]);

            // Setando o que eu iria setar de qualquer forma 
            setTrabalhosConfigs(response1)
            setUsuarioTrabalhos(response2.data)
            setIsLoading(false)
        };
        fetchData()

    }, [isLoading])

    if (isLoading) {
        return (
            <div className='loading-container'>
                <h1 className='loading-text'>CARREGANDO</h1>
            </div>
        )
    }

    return (
        <div className='trabalhos-main'>
            <div className='trabalhos-container'>
                <div className='publicacao-status'>
                    <h1>
                        DATA DE PUBLICAÇÃO
                    </h1>
                    <div>
                        {
                            !trabalhosConfigs.isOpen ?
                                <div>
                                    <h1>A publicação de trabalhos está fechada, e ainda não temos uma data definida para a abertura.</h1>
                                    <p>Não se preocupe, fique ligado em nossas redes sociais, para novas novidades!</p>
                                </div>
                                :
                                isTodayBetweenDates(trabalhosConfigs.data_inicio_submissao, trabalhosConfigs.data_limite_submissao) ?
                                    <div>
                                        <h1>O período de submissão de trabalhos está aberto!</h1>
                                        <div className='datas-container'>
                                            <h1>Não Perca as Datas!</h1>
                                            <div className='datas-grid'>
                                                <div className='data-item'>
                                                    <p>Início</p>
                                                    <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                                </div>
                                                <div className='data-item'>
                                                    <p>Fim</p>
                                                    <p>{new Date(trabalhosConfigs.data_limite_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_limite_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_limite_submissao).getFullYear()}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <button className='btn-submeter' onClick={() => router.push(`/painel/trabalhos/enviarTrabalho`)}>Submeter trabalho!</button>
                                    </div>
                                    :
                                    <div>
                                        <h1>O período de submissão de trabalhos está fechado!</h1>
                                        <div className='datas-container'>
                                            <h1>Os períodos de submissão foram</h1>
                                            <div className='datas-grid'>
                                                <div className='data-item'>
                                                    <p>Início</p>
                                                    <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                                </div>
                                                <div className='data-item'>
                                                    <p>Fim</p>
                                                    <p>{new Date(trabalhosConfigs.data_limite_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_limite_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_limite_submissao).getFullYear()}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <p className='btn-correcao'>Não se preocupe! Caso você tenha feito algum submissão, você pode acompanha-las abaixo!</p>
                                    </div>
                        }
                    </div>
                </div>
                <div className='publicacoes-section'>
                    <h1>
                        Suas Publicações
                    </h1>
                    <div className='flex items-center justify-center content-center'>
                        {
                            !usuarioTrabalhos.length ?
                                <div className='sem-trabalhos'>
                                    <h1>Você ainda não realizou nenhuma submissão</h1>
                                </div>
                                :
                                <div className='w-full space-y-5'>
                                    {
                                        usuarioTrabalhos.map((trabalho) => <TrabalhoPostado key={`${trabalho._id}`} propsTrabalho={trabalho} />)
                                    }
                                </div>
                        }
                    </div>
                </div>
            </div>
        </div>

    );
}
const TrabalhoPostado: React.FC<{ propsTrabalho: IAcademicWorks }> = ({ propsTrabalho }) => {
    const router = useRouter()
    const {
        _id,
        titulo,
        modalidade,
        autores,
        arquivos,
        topicos,
        status,
        dataSubmissao,
        avaliadorComentarios,
    } = propsTrabalho;

    // Lógica para definir a cor do status
    const statusClass =
        status === "Aceito"
            ? 'status-aceito'
            : status === "Recusado"
                ? 'status-recusado'
                : status === "Em Avaliação"
                    ? 'status-avaliacao'
                    : 'status-correcao';

    const statusIcon =
        status === "Aceito" ? (
            <CheckCircle className="h-4 w-4" />
        ) : status === "Recusado" ? (
            <XCircle className="h-4 w-4" />
        ) : (
            <Eye className="h-4 w-4" />
        );

    const [expandirTopicos, setExpandirTopicos] = useState<boolean>(false)
    const [expandirComentariosBanca, setExpandirComentariosBanca] = useState<boolean>(false)

    return (
        <div className="trabalho-card">
            {/* Cabeçalho do Card */}
            <div className="card-header">
                <h2 className="card-title">
                    <FileText className="h-6 w-6" />
                    {titulo}
                </h2>
                <div className={`card-status ${statusClass}`}>
                    {statusIcon}
                    <span>{status}</span>
                </div>
            </div>

            {/* Grid de Informações Principais */}
            <div className="info-grid">
                <div className="info-item">
                    <span className="info-label">
                        <User className="h-4 w-4" /> ID da Obra
                    </span>
                    <p className="info-value">{`${_id}`}</p>
                </div>

                <div className="info-item">
                    <span className="info-label">
                        <Layers className="h-4 w-4" /> Modalidade
                    </span>
                    <p className="info-value">{modalidade}</p>
                </div>

                <div className="info-item">
                    <span className="info-label">
                        <Calendar className="h-4 w-4" /> Data de Submissão
                    </span>
                    <p className="info-value">{new Date(dataSubmissao).toLocaleDateString()}</p>
                </div>
            </div>

            {/* Seção de Autores */}
            <div className="autores-section">
                <h3>
                    <User className="h-5 w-5" /> Autores
                </h3>
                <ul className="space-y-2">
                    {autores?.map((autor, index) => (
                        <li key={index} className="autor-item">
                            <span className="autor-nome">{autor.nome}</span>
                            <span className="autor-email">({autor.email})</span>
                            {autor.isOrientador && (
                                <span className="autor-badge badge-orientador">
                                    Orientador
                                </span>
                            )}
                            {autor.isPagante && (
                                <span className="autor-badge badge-pagante">
                                    Pagante
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Seção de Arquivo */}
            <div className="arquivos-section">
                <h3>
                    <File className="h-5 w-5" /> Arquivos Postados
                </h3>
                {
                    arquivos.map((arquivo) => {
                        return (
                            <div className='arquivo-item' key={`${arquivo.fileId}`}>
                                <h3 className="arquivo-header" onClick={() => console.log(arquivo)}>
                                    <File className="h-5 w-5" /> Arquivo
                                </h3>
                                <div className="arquivo-info">
                                    <p className="arquivo-nome">{arquivo?.fileName}</p>
                                    <a
                                        href={arquivo?.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="arquivo-link"
                                    >
                                        <Link className="h-4 w-4" />
                                        Visualizar
                                    </a>
                                </div>
                                <div className="arquivo-info">
                                    <span>Postado em:</span>
                                    <p className="arquivo-data">{new Date(arquivo?.uploadDate).toDateString()}</p>
                                </div>
                            </div>
                        )
                    })
                }
                {
                    propsTrabalho.arquivos.length === 0 && (
                        <div className='sem-trabalhos'>
                            <h1>Você ainda não submeteu nenhum trabalho.</h1>
                        </div>
                    )
                }
            </div>

            {/* Seção de Tópicos (se houver) */}
            {topicos && (
                <div className="topicos-section">
                    <div className='topicos-header'>
                        <h3 className="topicos-title">
                            <Tag className="h-5 w-5" /> Tópicos
                        </h3>
                        <button className='btn-toggle' onClick={() => setExpandirTopicos((prev) => !prev)}>{expandirTopicos ? `Expandir` : `Recolher`}</button>
                    </div>
                    <div className="topicos-content">
                        {
                            expandirTopicos &&
                            Object.entries(topicos).map(([key, value]) => (
                                <div key={key} className="topico-item">
                                    <p className="topico-chave">{key}</p>
                                    <p className="topico-valor">{value}</p>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Seção de Comentários */}
            <div className='comentarios-section'>
                <div className='comentarios-header'>
                    <h3 className="comentarios-title">
                        <MessageSquare className="h-5 w-5" /> Comentários da Banca
                    </h3>
                    <button className='btn-toggle' onClick={() => setExpandirComentariosBanca((prev) => !prev)}>{expandirComentariosBanca ? `Expandir` : `Recolher`}</button>
                </div>
                <div>
                    {/* Seção de Comentários do Avaliador (se houver) */}
                    {(avaliadorComentarios && avaliadorComentarios.length > 0 && expandirComentariosBanca) && (
                        <ul className="comentarios-list">
                            {avaliadorComentarios.map((comentario, index) => (
                                <li key={index} className="comentario-item">
                                    {comentario}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            
            <div className='w-full pt-10'>
                {
                    propsTrabalho.status === "Correção de Erros" &&
                    <button className='btn-correcao' onClick={() => router.push(`/painel/trabalhos/correcao/${propsTrabalho._id}`)}>Realizar Correção</button>
                }
            </div>
        </div>
    );
};