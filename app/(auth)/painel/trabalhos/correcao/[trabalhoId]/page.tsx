"use client"

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react"
import "./style.css"
import { ObjectId } from "bson";
import { IAcademicWorks, ArquivoUpload } from "@/lib/types/academicWorks/academicWorks.t";
import { Paperclip, Loader, CheckCircle, AlertCircle, X, Upload, Plus } from "lucide-react";
import DOMPurify from "dompurify";
import { useRouter } from "next/navigation";
//
//
// Função para gerar um nome de arquivo único, evitando conflitos no armazenamento.
const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');

    return `${nameWithoutExtension}_${timestamp}_${randomString}.${extension}`;
};
// Função de fetch com retentativas para maior resiliência da rede.
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status >= 500) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === retries - 1) {
                throw error;
            }
            const delay = Math.pow(2, i) * 1000;
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error("A operação falhou após múltiplas tentativas.");
}
//

// Função para formatar tamanho do arquivo
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
//
export default function Page({ params }: { params: Promise<{ trabalhoId: string }> }) {
    const [trabalhoData, setTrabalhoData] = useState<IAcademicWorks | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    useEffect(() => {
        const fetchData = async () => {
            try {

                const { trabalhoId } = await params;
                const response = await fetch(`/api/get/usuariosTrabalhos/${trabalhoId}`);
                if (!response.ok) {
                    // Handle error
                    const errMessage: { message: string } = await response.json();
                    alert(errMessage.message);
                    return;
                }
                const { data }: { data: IAcademicWorks } = await response.json();
                setTrabalhoData(data);
            }
            finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    return (
        <main className="min-h-screen min-w-screen">
            {
                loading &&
                <div className="fixed w-full">
                    <p className="w-full min-h-screen flex items-center justify-center content-center bg-red-500 text-white text-center">C A R R E G A N D O</p>
                </div>
            }
            <div>
                {
                    trabalhoData &&
                    <TrabalhoComponent setIsLoading={setLoading} trabalho={trabalhoData} setTrabalhoData={setTrabalhoData} />
                }
            </div>
        </main>
    )
}


const TrabalhoComponent: React.FC<{ trabalho: IAcademicWorks, setTrabalhoData: React.Dispatch<React.SetStateAction<IAcademicWorks>>, setIsLoading: Dispatch<SetStateAction<boolean>> }> = ({ trabalho, setTrabalhoData, setIsLoading }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter()
    const [trabalhosMarcadosParaRemocao, setTrabalhosMarcadosParaRemocao] = useState<ObjectId[]>([]);
    // Função para atualizar progresso de um arquivo específico
    //
    // MODIFICAÇÃO: Estado para múltiplos arquivos
    const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);

    const [formError, setFormError] = useState<string | null>(null);

    //
    const updateFileProgress = (fileId: string, progress: number, status: ArquivoUpload['status'], error?: string) => {
        setArquivos(prev => prev.map(arquivo =>
            arquivo.id === fileId
                ? { ...arquivo, progress, status, error }
                : arquivo
        ));
    };

    const uploadSingleFile = async (file: File, fileName: string, fileId: string): Promise<string | null> => {
        const formData = new FormData();
        formData.append('file', file);
        const uniqueFileName = generateUniqueFileName(fileName);
        formData.append('originalFileName', uniqueFileName);

        try {
            updateFileProgress(fileId, 30, 'uploading');
            const response = await fetchWithRetry('/api/post/uploadBlobSingle', { method: 'POST', body: formData });
            updateFileProgress(fileId, 70, 'uploading');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erro no upload: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result.data || !result.data._id) throw new Error('A API de upload não retornou um ID de arquivo válido.');

            updateFileProgress(fileId, 100, 'completed');
            return result.data._id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
            updateFileProgress(fileId, 0, 'error', errorMessage);
            return null;
        }
    };

    const uploadChunkedFile = async (file: File, fileName: string, fileId: string): Promise<string | null> => {
        const totalChunks = Math.ceil(file.size / trabalho.configuracaoModalidade.chunk_tamanho);
        const chunkIds: string[] = [];
        const uniqueFileName = generateUniqueFileName(fileName);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * trabalho.configuracaoModalidade.chunk_tamanho;
                const end = Math.min(start + trabalho.configuracaoModalidade.chunk_tamanho, file.size);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('chunkIndex', i.toString());
                formData.append('totalChunks', totalChunks.toString());
                formData.append('fileName', uniqueFileName);

                const response = await fetchWithRetry('/api/post/uploadBlobChunk', { method: 'POST', body: formData });
                if (!response.ok) throw new Error(`Erro no upload do chunk ${i + 1}`);

                const result = await response.json();
                chunkIds.push(result.chunkId);
                updateFileProgress(fileId, ((i + 1) / totalChunks) * 90, 'uploading');
            }

            const reconstructResponse = await fetchWithRetry('/api/post/reconstructBlobFile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chunkFileName: uniqueFileName, finalFileName: uniqueFileName, chunkIds, totalSize: file.size }),
            });

            if (!reconstructResponse.ok) throw new Error('Erro na reconstrução do arquivo');

            const result = await reconstructResponse.json();
            if (!result.data || !result.data._id) throw new Error('A API de reconstrução não retornou um ID válido.');

            updateFileProgress(fileId, 100, 'completed');
            return result.data._id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
            updateFileProgress(fileId, 0, 'error', errorMessage);
            return null;
        }
    };

    // MODIFICAÇÃO: Função para processar múltiplos arquivos
    const handleMultipleFileUpload = async (files: FileList) => {

        const newFiles: ArquivoUpload[] = [];

        // Verificar se não excede o limite máximo
        if (arquivos.length + files.length > trabalho.configuracaoModalidade.postagens_maximas) {
            setFormError(`Você pode anexar no máximo ${trabalho.configuracaoModalidade.postagens_maximas} arquivos por submissão.`);
            return;
        }

        // Criar objetos de arquivo para cada arquivo selecionado
        Array.from(files).forEach(file => {
            if (file.size > trabalho.configuracaoModalidade.limite_maximo_de_postagem) {
                setFormError(`O arquivo "${file.name}" excede o limite de ${trabalho.configuracaoModalidade.limite_maximo_de_postagem / 1024 / 1024}MB.`);
                return;
            }

            const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            newFiles.push({
                id: fileId,
                fileName: file.name,
                originalName: file.name,
                size: file.size,
                status: 'uploading',
                progress: 0
            });
        });

        // Adicionar arquivos ao estado
        setArquivos(prev => [...prev, ...newFiles]);
        setFormError(null);

        // Processar uploads em paralelo
        const uploadPromises = Array.from(files).map(async (file, index) => {
            const fileId = newFiles[index]?.id;
            if (!fileId) return null;

            const uploadFunction = file.size > trabalho.configuracaoModalidade.chunk_limite ? uploadChunkedFile : uploadSingleFile;
            const uploadedFileId = await uploadFunction(file, file.name, fileId);

            if (uploadedFileId) {
                // Atualizar o arquivo com o ID do servidor
                setArquivos(prev => prev.map(arquivo =>
                    arquivo.id === fileId
                        ? { ...arquivo, id: uploadedFileId }
                        : arquivo
                ));
                return uploadedFileId;
            }
            return null;
        });

        await Promise.all(uploadPromises);
    };

    // NOVA FUNÇÃO: Remover arquivo da lista
    const removeFile = (fileId: string) => {
        setArquivos(prev => prev.filter(arquivo => arquivo.id !== fileId));
    };

    // 
    const sendToApi = async () => {
        setIsLoading(true)
        await fetch("/api/put/academicWork/", {
            method: "PUT",
            body: JSON.stringify({
                academicWork: trabalho,
                newFiles: arquivos
            })
        }).then(() => {
            setIsLoading(false)
            router.push("/painel/trabalhos/")
alert("Correção enviada com sucesso!")
        })
    }


return (
    <div className="text-black shadow-md p-10">
        <div className="p-5">
            <div className="text-center">
                <h2>{trabalho.titulo}</h2>
            </div>
            <div>
                Status: <span>{trabalho.status}</span>
            </div>
            <div className="">
                <div className="text-center">
                    <h3 className="w-full text-center text-2xl font-extrabold">Comentários dos Avaliadores</h3>
                </div>
                <div className="space-y-2">
                    {
                        trabalho.avaliadorComentarios.length === 0 ? <span>Nenhum comentário disponível.</span> :
                            trabalho.avaliadorComentarios.map((comentario, index) => (
                                <div key={index} className="relative border p-2 my-2">
                                    {
                                        index === trabalho.avaliadorComentarios.length - 1 &&
                                        <div className="bg-red-400 font-extrabold text-sm p-2 w-fit h-fit rounded-sm">
                                            <p>COMENTÁRIO DE ÚLTIMA AVALIAÇÃO</p>
                                        </div>
                                    }
                                    <p><strong>Avaliação {index + 1}: {new Date(comentario.date).toLocaleDateString()}</strong></p>
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentario.comentario) }} />
                                </div>
                            ))
                    }
                </div>
            </div>
            <div className="bg-blue-100 text-black p-5 space-y-5">
                <div className="text-center">
                    <h3 className="w-full text-center text-2xl font-extrabold">Detalhes dos Autores</h3>
                </div>
                <div className="w-full text-center">
                    <p>Caso queira fazer alguma alteração, entre em contato com a Organização do Congresso.</p>
                </div>
                <div>
                    {
                        trabalho.autores.map((trabalho) => {
                            return (
                                <div className="relative bg-red-100 p-5">
                                    <div className="absolute inset-0 bg-red-500 px-3 rounded-2xl font-extrabold text-white w-fit h-fit p-1 -top-[10px]">
                                        <p>{trabalho.isOrientador ? "Orientador" : ""}</p>
                                    </div>
                                    <div>
                                        <p>{trabalho.nome}</p>
                                        <p>{trabalho.cpf}</p>
                                        <p>{trabalho.email}</p>
                                        <p>Pagante: {trabalho.isPagante ? "Sim" : "Não"}</p>
                                    </div>
                                </div>
                            )
                        })
                    }
                </div>
            </div>
            <div>
                <p className="w-full text-center">Abaixo, você será capaz de realizar as alterações necessárias. Lembre-se, depois de enviado, não tem mais volta.</p>
            </div>
            <div className="w-full bg-orange-300 p-5">
                <p className="text-center w-full text-2xl font-extrabold">Tópicos</p>
                <div className="space-y-2">
                    {
                        Object.entries(trabalho.topicos).map(([key, value]) => (
                            <div key={key}>
                                <h3>{key}</h3>
                                <input type="text" className="text-black" value={value} onChange={(e) => {
                                    const newValue = e.target.value;
                                    setTrabalhoData((prevData) => ({
                                        ...prevData,
                                        topicos: {
                                            ...prevData.topicos,
                                            [key]: newValue
                                        }
                                    }));
                                }} />
                                {/*<p>{value}</p>*/}
                            </div>
                        ))
                    }
                </div>
            </div>
            <div className="w-full text-center py-3">
                <div>
                    <h1 className="font-extrabold text-2xl">ARQUIVOS</h1>
                </div>
                <div className="bg-red-100">
                    {/**
                         * Esse é o bloque de arquivos já postados. Por motivo de segurança, o usuário não é capaz de alterar esse documento após realizar a postagem.
                         * Somente um ADM consegue fazer isso!!!
                         * Colocar em algum lugar aqui nesse bloco que o usuário não será capaz de apagar os arquivos já postados.
                         */}
                    <div className="py-3 space-y-5">
                        <div className="w-full flex justify-center">
                            <h1 className="bg-red-500 w-fit p-2 rounded-xl">Arquivos já postados</h1>
                        </div>
                        <div>
                            <p>Abaixo todos os seus arquivos que foram postados por você até agora</p>
                            <p>[Você não pode alterar esses arquivos]</p>
                        </div>
                        <div>
                            {
                                trabalho.arquivos.map((arquivo, index) => (
                                    <div key={index} className="border p-2 my-2 flex justify-between items-center text-black">
                                        <div className="flex items-center gap-2">
                                            <Paperclip />
                                            <a href={arquivo.url} target="_blank" rel="noopener noreferrer" className="underline">
                                                {arquivo.originalName}
                                            </a>
                                        </div>
                                        <div className="text-sm text-gray-800 space-x-5">
                                            <span>{(arquivo.size / (1024 * 1024)).toFixed(2)} MB</span> | <span>{new Date(arquivo.uploadDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
                <div className="bg-red-100 space-y-5 py-5">
                    {/**
                         * Esse é o bloco para o usuário postar um novo arquivo. Temos que deixar claro que ele só precisa postar se foi solicitado a ele no último comentário
                         */}
                    <div className="w-full flex justify-center">
                        <h1 className="bg-red-500 w-fit p-2 rounded-xl">Postar Novo Arquivo</h1>
                    </div>

                    <div className="flex items-center justify-center">
                        <div className="text-center flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-8 hover:border-blue-400 transition-colors duration-300">
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        handleMultipleFileUpload(e.target.files);
                                    }
                                }}
                                className="hidden"
                                accept=".pdf,.doc,.docx"
                            />
                            <Upload className="text-blue-500 h-12 w-12 mb-4" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium text-white transition-all duration-200 ${arquivos.length >= trabalho.configuracaoModalidade.postagens_maximas
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                                    }`}
                                disabled={arquivos.length >= trabalho.configuracaoModalidade.postagens_maximas}
                            >
                                <Plus size={16} className="mr-2" />
                                {arquivos.length === 0 ? 'Selecionar arquivos' : 'Adicionar mais arquivos'}
                            </button>

                            <p className="text-sm text-gray-500 mt-3">
                                PDF, DOC ou DOCX até{' '}
                                <span className="font-semibold text-gray-700">
                                    {trabalho.configuracaoModalidade.limite_maximo_de_postagem / 1024 / 1024}MB
                                </span>{' '}
                                cada
                            </p>

                            <p className="text-sm text-gray-600 mt-1">
                                {arquivos.length}/
                                {trabalho.configuracaoModalidade.postagens_maximas} arquivos selecionados
                            </p>
                        </div>

                    </div>
                    {arquivos.length > 0 && (
                        <div className="space-x-5 border-2 border-dashed border-gray-800 p-3">
                            <div className="arquivos-lista">
                                <h4 className="arquivos-titulo">Arquivos anexados:</h4>
                                {
                                    arquivos.map((arquivo, index) => (
                                        <div key={arquivo.id} className="arquivo-item text-start">
                                            <div className="arquivo-header">
                                                <div className="arquivo-info">
                                                    <p className="arquivo-nome">
                                                        {arquivo.originalName}
                                                    </p>
                                                    <p className="arquivo-tamanho">
                                                        {formatFileSize(arquivo.size)}
                                                    </p>
                                                </div>

                                                <div className="arquivo-acoes">
                                                    {arquivo.status === 'uploading' && (
                                                        <Loader className="animate-spin text-blue-500" size={16} />
                                                    )}
                                                    {arquivo.status === 'completed' && (
                                                        <CheckCircle className="text-green-500" size={16} />
                                                    )}
                                                    {arquivo.status === 'error' && (
                                                        <AlertCircle className="text-red-500" size={16} />
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(arquivo.id)}
                                                        className="remover-arquivo"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Barra de progresso */}
                                            {arquivo.status === 'uploading' && (
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-fill"
                                                        style={{ width: `${arquivo.progress}%` }}
                                                    ></div>
                                                </div>
                                            )}

                                            {/* Mensagem de erro */}
                                            {arquivo.status === 'error' && arquivo.error && (
                                                <p className="text-xs text-red-600 mt-1">{arquivo.error}</p>
                                            )}

                                            {/* Status */}
                                            <div className="flex items-center mt-2">
                                                <span className={`text-xs ${arquivo.status === 'completed' ? 'status-completed' :
                                                    arquivo.status === 'error' ? 'status-error' : 'status-uploading'
                                                    }`}>
                                                    {arquivo.status === 'uploading' && `Enviando... ${arquivo.progress}%`}
                                                    {arquivo.status === 'completed' && 'Upload concluído!'}
                                                    {arquivo.status === 'error' && 'Erro no upload'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="w-full flex items-center justify-center">
                <button className="bg-red-800 text-white py-3 px-8 text-sm font-extrabold" onClick={() => {
                    if (confirm("Ao enviar essa correção não será possível realizar nenhuma alteração. Deseja mesmo continuar?")) {
                        sendToApi()
                    }
                }}>ENVIAR CORREÇÃO</button>
            </div>
        </div>
    </div >
);
};