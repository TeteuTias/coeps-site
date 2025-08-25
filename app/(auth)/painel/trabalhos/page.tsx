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
            <div className='min-h-screen flex items-center content-center justify-center'>
                <h1 className='text-black'>CARREGANDO</h1>
            </div>
        )
    }

    return (
        <>
            <div className='w-full justify-center text-center content-center text-black bg-blue-100 py-5'>
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
                                    <div className='flex flex-col w-full'>
                                        <h1>Não Perca as Datas!</h1>
                                        <div className='flex flex-row justify-center space-x-5 bg-red-100'>
                                            <div>
                                                <p>Início</p>
                                                <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                            </div>
                                            <div>
                                                <p>Fim</p>
                                                <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button className='bg-red-300 text-white font-bold p-3' onClick={() => router.push(`/painel/trabalhos/enviarTrabalho`)}>Submeter trabalho!</button>
                                </div>
                                :
                                <div>
                                    <h1>O período de submissão de trabalhos está fechado!</h1>
                                    <div className='flex flex-col w-full'>
                                        <h1>Os períodos de submissão foram</h1>
                                        <div className='flex flex-row justify-center space-x-5 bg-red-100'>
                                            <div>
                                                <p>Início</p>
                                                <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                            </div>
                                            <div>
                                                <p>Fim</p>
                                                <p>{new Date(trabalhosConfigs.data_inicio_submissao).getDate() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getMonth() + "-" + new Date(trabalhosConfigs.data_inicio_submissao).getFullYear()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className='bg-red-300 text-white font-bold p-3'>Não se preocupe! Caso você tenha feito algum submissão, você pode acompanha-las abaixo!</p>
                                </div>
                    }
                </div>
            </div>
            <div className='w-full justify-center text-center content-center text-black bg-blue-100 py-5'>
                <h1>
                    Suas Publicações
                </h1>
                <div className='flex items-center justify-center content-center'>
                    {
                        !usuarioTrabalhos.length ?
                            <div>
                                <h1>Você ainda não realizou nenhuma submissão</h1>
                            </div>
                            :
                            <div className='w-1/2 space-y-5'>
                                {
                                    usuarioTrabalhos.map((trabalho) => <TrabalhoPostado key={`${trabalho._id}`} propsTrabalho={trabalho} />)
                                }
                            </div>
                    }
                </div>
            </div>
        </>

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
    const statusColor =
        status === "Aceito"
            ? 'text-green-600'
            : status === "Recusado"
                ? 'text-red-600'
                : status === "Em Avaliação"
                    ? 'text-yellow-600'
                    : 'text-blue-600';

    const statusIcon =
        status === "Aceito" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
        ) : status === "Recusado" ? (
            <XCircle className="h-4 w-4 text-red-600" />
        ) : (
            <Eye className="h-4 w-4 text-gray-600" />
        );

    const [expandirTopicos, setExpandirTopicos] = useState<boolean>(false)
    const [expandirComentariosBanca, setExpandirComentariosBanca] = useState<boolean>(false)

    return (
        <div className="bg-white rounded-lg shadow-md p-6 my-4 border border-gray-200">
            {/* Cabeçalho do Card */}
            <div className="flex justify-between items-center border-b pb-4 mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="h-6 w-6 text-gray-500" />
                    {titulo}
                </h2>
                <div className={`flex items-center gap-1 font-semibold ${statusColor}`}>
                    {statusIcon}
                    <span>{status}</span>
                </div>
            </div>

            {/* Grid de Informações Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-700">
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-500 flex items-center gap-1">
                        <User className="h-4 w-4" /> ID da Obra
                    </span>
                    <p className="mt-1 text-sm break-all">{`${_id}`}</p>
                </div>

                <div className="flex flex-col">
                    <span className="font-semibold text-gray-500 flex items-center gap-1">
                        <Layers className="h-4 w-4" /> Modalidade
                    </span>
                    <p className="mt-1">{modalidade}</p>
                </div>

                <div className="flex flex-col">
                    <span className="font-semibold text-gray-500 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> Data de Submissão
                    </span>
                    <p className="mt-1">{new Date(dataSubmissao).toLocaleDateString()}</p>
                </div>
            </div>

            <hr className="my-6" />

            {/* Seção de Autores */}
            <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
                    <User className="h-5 w-5" /> Autores
                </h3>
                <ul className="space-y-2 text-gray-700">
                    {autores?.map((autor, index) => (
                        <li key={index} className="flex items-center gap-2 bg-gray-100 p-2 rounded-md">
                            <span className="font-medium">{autor.nome}</span>
                            <span className="text-sm text-gray-500">({autor.email})</span>
                            {autor.isOrientador && (
                                <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                                    Orientador
                                </span>
                            )}
                            {autor.isPagante && (
                                <span className="bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                                    Pagante
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <hr className="my-6" />

            {/* Seção de Arquivo */}
            <div className="mt-4 space-y-5">
                <div className='w-full flex items-center justify-center flex-row'>
                    <File className="h-5 w-5" /> Arquivos Postados
                </div>
                {
                    arquivos.map((arquivo) => {
                        return (
                            <div className='bg-gray-100 p-2' key={`${arquivo.fileId}`}>
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3" onClick={() => console.log(arquivo)}>
                                    <File className="h-5 w-5" /> Arquivo
                                </h3>
                                <div className="flex items-center gap-2 text-gray-700">
                                    <p className="flex-1">{arquivo?.fileName}</p>
                                    <a
                                        href={arquivo?.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-blue-600 hover:underline"
                                    >
                                        <Link className="h-4 w-4" />
                                        Visualizar
                                    </a>
                                </div>
                                <div className="flex items-center gap-2 text-gray-700">
                                    Postado em: <p className="flex-1">{new Date(arquivo?.uploadDate).toDateString()}</p>
                                </div>

                            </div>
                        )
                    })
                }
                {
                    propsTrabalho.arquivos.length === 0 && (
                        <div>
                            <h1>Você ainda não submeteu nenhum trabalho.</h1>
                        </div>
                    )
                }

            </div>

            {/* Seção de Tópicos (se houver) */}
            {topicos && (
                <>
                    <hr className="my-6" />
                    <div className="mt-4">
                        <div className='flex flex-row space-x-5 items-start justify-start'>
                            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
                                <Tag className="h-5 w-5" /> Tópicos
                            </h3>
                            <button className='bg-red-800 p-2 text-white font-extrabold' onClick={() => setExpandirTopicos((prev) => !prev)}>{expandirTopicos ? `Expandir` : `Recolher`}</button>
                        </div>
                        <div className="flex items-start justify-start flex-col text-start space-y-5 text-gray-700">
                            {
                                expandirTopicos &&
                                Object.entries(topicos).map(([key, value]) => (
                                    <div key={key}>
                                        <p className="font-semibold capitalize">{key}</p>
                                        <p className="text-sm italic">{value}</p>
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}


            {/* */}
            <div className='flex flex-col space-x-5 items-start justify-start'>
                <div className='w-full flex flex-row space-x-5'>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
                        <MessageSquare className="h-5 w-5" /> Comentários da Banca
                    </h3>
                    <button className='bg-red-800 p-2 text-white font-extrabold' onClick={() => setExpandirComentariosBanca((prev) => !prev)}>{expandirComentariosBanca ? `Expandir` : `Recolher`}</button>
                </div>
                <div>
                    {/* Seção de Comentários do Avaliador (se houver) */}
                    {(avaliadorComentarios && avaliadorComentarios.length > 0 && expandirComentariosBanca) && (
                        <>
                            <div className="mt-4">
                                <ul className="space-y-2 list-disc list-inside text-gray-700">
                                    {avaliadorComentarios.map((comentario, index) => (
                                        <li key={index} className="text-sm">
                                            {comentario}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className='w-full pt-10'>
                {
                    propsTrabalho.status === "Correção de Erros" &&
                    <button className='bg-red-500 text-white font-extrabold p-2' onClick={() => router.push(`/painel/trabalhos/correcao/${propsTrabalho._id}`)}>Realizar Correção</button>
                }
            </div>
        </div>
    );
};