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
    Trash2,
} from 'lucide-react'
import './style.css';
import HtmlSanitizer from '@/app/utils/htmlSanitizer';

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
                                                    <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + Number(new Date(trabalhosConfigs.data_inicio_submissao).getMonth()) + 1 + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                                </div>
                                                <div className='data-item'>
                                                    <p>Fim</p>
                                                    <p>{new Date(trabalhosConfigs.data_limite_submissao).getDate() + "-" + Number(new Date(trabalhosConfigs.data_limite_submissao).getMonth()) + 1 + "-" + new Date(trabalhosConfigs.data_limite_submissao).getFullYear()}</p>
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
    const [isDeleting, setIsDeleting] = useState(false)
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

    // Função para excluir trabalho
    const handleDeleteWork = async () => {
        // Confirmação do navegador
        const confirmMessage = `Tem certeza que deseja excluir o trabalho "${titulo}"?\n\nEsta ação não pode ser desfeita e todos os arquivos e dados relacionados serão permanentemente removidos.`
        
        if (!confirm(confirmMessage)) {
            return;
        }

        setIsDeleting(true);
        
        try {
            // TODO: Implementar chamada para API de exclusão
            // const response = await fetch('/api/delete/trabalho', {
            //     method: 'DELETE',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({
            //         trabalhoId: _id
            //     })
            // });

            // if (!response.ok) {
            //     const errorData = await response.json();
            //     throw new Error(errorData.message || 'Erro ao excluir trabalho');
            // }

            // const result = await response.json();
            
            // Simulação temporária - remover quando API estiver implementada
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            alert('Trabalho excluído com sucesso!');
            
            // TODO: Atualizar lista de trabalhos após exclusão
            // window.location.reload(); // Solução temporária
            
        } catch (error) {
            console.error('Erro ao excluir trabalho:', error);
            alert(error instanceof Error ? error.message : 'Erro desconhecido ao excluir trabalho');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="trabalho-card">
            {/* Cabeçalho do Card */}
            <div className="card-header">
                <h2 className="card-title">
                    <FileText className="h-6 w-6" />
                    {titulo}
                </h2>
                <div className="card-header-actions">
                    <div className={`card-status ${propsTrabalho.status} text-orange-500`}>
                        {statusIcon}
                        <span>{status}</span>
                    </div>
                    <button
                        onClick={handleDeleteWork}
                        disabled={isDeleting}
                        className="btn-delete-work"
                        title="Excluir trabalho"
                    >
                        {isDeleting ? (
                            <div className="loading-spinner-small"></div>
                        ) : (
                            <Trash2 size={16} />
                        )}
                    </button>
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
                            <div className='arquivo-item text-start' key={`${arquivo.fileId}`}>
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
                                <div className="arquivo-info text-black">
                                    <span>Postado em:</span>
                                    <p className="arquivo-data">
                                        {new Date(arquivo?.uploadDate).toLocaleDateString('pt-BR', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })} às {new Date(arquivo?.uploadDate).toLocaleTimeString('pt-BR')}
                                    </p>
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
                {
                    expandirComentariosBanca &&
                    <div>
                        {propsTrabalho.avaliadorComentarios.length === 0 ? (
                            <p className="text-gray-500 text-sm">Nenhuma avaliação foi feita ainda.</p>
                        ) : (
                            <div className='space-y-5'>
                                <p className='w-full text-center text-gray-500'>Avaliações já realizadas</p>
                                {
                                    propsTrabalho.avaliadorComentarios.map((comentario, index) => (
                                        <div
                                            key={index}
                                            className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md"
                                        >
                                            <div>
                                                {index === propsTrabalho.avaliadorComentarios.length - 1 &&
                                                    <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full mb-2 inline-block animate-pulse">
                                                        ÚLTIMA AVALIAÇÃO
                                                    </span>
                                                }
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between pb-10 text-sm text-gray-500 gap-x-4 gap-y-2">
                                                <p>
                                                    <span className="font-medium text-gray-700">Data:</span>{' '}
                                                    {new Date(comentario.date).toLocaleDateString('pt-BR', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })} às {new Date(comentario.date).toLocaleTimeString('pt-BR')}
                                                </p>
                                                <span
                                                    className={`
        px-3 py-1 rounded-full text-xs font-semibold
        ${comentario.status === 'Aceito'
                                                            ? 'bg-green-100 text-green-800'
                                                            : comentario.status === 'Recusado'
                                                                ? 'bg-red-100 text-red-800'
                                                                : 'bg-yellow-100 text-yellow-800'
                                                        }
      `}
                                                >
                                                    {comentario.status}
                                                </span>
                                            </div>
                                            <div className="mb-3 text-black" dangerouslySetInnerHTML={{ __html: HtmlSanitizer(comentario.comentario) }}>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                }
            </div>

            <div className='w-full pt-10'>
                <div className="actions-row">
                    {
                        propsTrabalho.status === "Necessita de Alteração" &&
                        <button className='btn-correcao' onClick={() => router.push(`/painel/trabalhos/correcao/${propsTrabalho._id}`)}>Realizar Correção</button>
                    }
                </div>
            </div>
        </div>
    );
};