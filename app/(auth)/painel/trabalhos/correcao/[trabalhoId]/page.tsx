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
    }, [params])

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

// Seu componente Page permanece o mesmo. Apenas o TrabalhoComponent é alterado.
// ... (código do componente Page)

// Este é o componente com o design modernizado.
const TrabalhoComponent: React.FC<{ trabalho: IAcademicWorks, setTrabalhoData: React.Dispatch<React.SetStateAction<IAcademicWorks | null>>, setIsLoading: Dispatch<SetStateAction<boolean>> }> = ({ trabalho, setTrabalhoData, setIsLoading }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);
    const [formError, setFormError] = useState<string | null>(null);

    // ==================================================================
    // LÓGICA DE UPLOAD QUE ESTAVA FALTANDO (ADICIONADA DE VOLTA AQUI)
    // ==================================================================
    const updateFileProgress = (fileId: string, progress: number, status: ArquivoUpload['status'], error?: string) => {
        setArquivos(prev => prev.map(arquivo =>
            arquivo.fileId === fileId
                ? { ...arquivo, progress, status, error }
                : arquivo
        ));
    };

    const uploadSingleFile = async (file: File, fileName: string, fileId: string): Promise<{ id: string, url: string } | null> => {
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
            return { id: result.data._id, url: result.data.url };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
            updateFileProgress(fileId, 0, 'error', errorMessage);
            return null;
        }
    };

    const uploadChunkedFile = async (file: File, fileName: string, fileId: string): Promise<{ id: string, url: string } | null> => {
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
            return { id: result.data._id, url: result.data.url };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
            updateFileProgress(fileId, 0, 'error', errorMessage);
            return null;
        }
    };

    const handleMultipleFileUpload = async (files: FileList) => {
        const newFiles: ArquivoUpload[] = [];

        if (arquivos.length + files.length > trabalho.configuracaoModalidade.postagens_maximas) {
            setFormError(`Você pode anexar no máximo ${trabalho.configuracaoModalidade.postagens_maximas} arquivos por submissão.`);
            return;
        }

        Array.from(files).forEach(file => {
            if (file.size > trabalho.configuracaoModalidade.limite_maximo_de_postagem) {
                setFormError(`O arquivo "${file.name}" excede o limite de ${trabalho.configuracaoModalidade.limite_maximo_de_postagem / 1024 / 1024}MB.`);
                return;
            }

            const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            newFiles.push({
                fileId: fileId,
                fileName: file.name,
                originalName: file.name,
                size: file.size,
                status: 'uploading',
                progress: 0
            });
        });

        setArquivos(prev => [...prev, ...newFiles]);
        setFormError(null);

        const uploadPromises = Array.from(files).map(async (file, index) => {
            const fileId = newFiles[index]?.fileId;
            if (!fileId) return null;

            const uploadFunction = file.size > trabalho.configuracaoModalidade.chunk_limite ? uploadChunkedFile : uploadSingleFile;
            const uploadedFile = await uploadFunction(file, file.name, fileId);

            if (uploadedFile) {
                setArquivos(prev => prev.map(arquivo =>
                    arquivo.fileId === fileId
                        ? { ...arquivo, id: uploadedFile.id as any, url: uploadedFile.url }
                        : arquivo
                ));
                return uploadedFile;
            }
            return null;
        });

        await Promise.all(uploadPromises);
    };
    // ==================================================================
    // FIM DO BLOCO DE LÓGICA
    // ==================================================================

    const removeFile = (fileId: string) => {
        setArquivos(prev => prev.filter(arquivo => arquivo.fileId !== fileId));
    };

    const sendToApi = async () => {
        setIsLoading(true);
        await fetch("/api/put/academicWork/", {
            method: "PUT",
            body: JSON.stringify({
                academicWork: trabalho,
                newFiles: arquivos
            })
        }).then(() => {
            setIsLoading(false);
            router.push("/painel/trabalhos/");
            alert("Correção enviada com sucesso!");
        });
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-slate-800">

                {/* CABEÇALHO */}
                <div className="text-center space-y-2 w-full flex items-center justify-center flex-col">
                    <h1 className="text-4xl font-bold text-slate-900">{trabalho.titulo}</h1>
                    <p className="text-lg text-white bg-red-800 w-fit px-3 py-2 rounded-lg"><span className="font-semibold">{trabalho.status}</span></p>
                </div>

                {/* CARD DE COMENTÁRIOS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900 mb-6">Comentários dos Avaliadores</h2>
                    <div className="space-y-6">
                        {trabalho.avaliadorComentarios.length === 0
                            ? <p className="text-slate-500">Nenhum comentário disponível.</p>
                            : trabalho.avaliadorComentarios.map((comentario, index) => (
                                <div key={index} className="border-l-4 border-indigo-500 pl-4">
                                    {index === trabalho.avaliadorComentarios.length - 1 &&
                                        <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-3 py-1 rounded-full mb-2 inline-block animate-pulse">
                                            ÚLTIMA AVALIAÇÃO
                                        </span>
                                    }
                                    <p className="font-semibold text-slate-700">
                                        Avaliação {index + 1}: {new Date(comentario.date).toLocaleString('pt-BR', {
                                            dateStyle: 'full',
                                            timeStyle: 'medium',
                                        })}
                                    </p>
                                    <div className="prose prose-slate max-w-none mt-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentario.comentario) }} />
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* CARD DE AUTORES */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Detalhes dos Autores</h2>
                    <p className="text-slate-500 mb-6">Para alterações nos autores, entre em contato com a organização do evento.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {trabalho.autores.map((autor) => (
                            <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-4" key={autor.nome + autor.cpf}>
                                {autor.isOrientador &&
                                    <span className="absolute -top-3 right-4 bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        Orientador
                                    </span>
                                }
                                <div className="space-y-1 text-sm">
                                    <p className="font-semibold text-slate-800">{autor.nome}</p>
                                    <p className="text-slate-600">{autor.cpf}</p>
                                    <p className="text-slate-600">{autor.email}</p>
                                    <p className="text-slate-600">Pagante: <span className="font-medium">{autor.isPagante ? "Sim" : "Não"}</span></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CARD DE TÓPICOS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-900 mb-6">Tópicos do Trabalho</h2>
                    <div className="space-y-4">
                        {Object.entries(trabalho.topicos).map(([key, value]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-slate-700 capitalize">{key}</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                                      focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    value={value}
                                    onChange={(e) => {
                                        const newValue = e.target.value;
                                        setTrabalhoData((prevData) => ({
                                            ...prevData!,
                                            topicos: {
                                                ...prevData!.topicos,
                                                [key]: newValue
                                            }
                                        }));
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* CARD DE ARQUIVOS */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-8">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Arquivos Já Enviados</h2>
                        <p className="text-slate-500 mb-4">Estes arquivos não podem ser alterados ou removidos.</p>
                        <div className="space-y-2">
                            {trabalho.arquivos.map((arquivo, index) => (
                                <a href={arquivo.url} target="_blank" rel="noopener noreferrer" key={index}
                                    className="flex justify-between items-center bg-slate-50 hover:bg-slate-100 border border-slate-200 p-3 rounded-lg transition-colors duration-200">
                                    <div className="flex items-center gap-3 font-medium text-indigo-600">
                                        <Paperclip className="h-5 w-5" />
                                        <span>{arquivo.originalName}</span>
                                    </div>
                                    <div className="text-sm text-slate-500 space-x-4">
                                        <span>{(arquivo.size / (1024 * 1024)).toFixed(2)} MB</span>
                                        <span>{new Date(arquivo.uploadDate).toLocaleDateString()}</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Anexar Novos Arquivos</h2>
                        <p className="text-slate-500 mb-4">Envie novos arquivos se solicitado na avaliação. Arraste e solte ou clique para selecionar.</p>

                        <div className="flex items-center justify-center">
                            <div className="w-full text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-indigo-500 transition-colors duration-300 bg-slate-50">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={(e) => e.target.files && handleMultipleFileUpload(e.target.files)}
                                    className="hidden"
                                    accept=".pdf,.doc,.docx"
                                />
                                <Upload className="text-indigo-500 h-10 w-10 mb-4" />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-200 shadow-sm ${arquivos.length >= trabalho.configuracaoModalidade.postagens_maximas
                                        ? 'bg-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                                        }`}
                                    disabled={arquivos.length >= trabalho.configuracaoModalidade.postagens_maximas}
                                >
                                    <Plus size={18} className="mr-2" />
                                    {arquivos.length === 0 ? 'Selecionar Arquivos' : 'Adicionar Mais'}
                                </button>
                                <p className="text-sm text-slate-500 mt-4">
                                    Arquivos de até <span className="font-semibold text-slate-700">{trabalho.configuracaoModalidade.limite_maximo_de_postagem / 1024 / 1024}MB</span> cada
                                </p>
                                <p className="text-sm text-slate-600 mt-1 font-medium">
                                    {arquivos.length}/{trabalho.configuracaoModalidade.postagens_maximas} arquivos selecionados
                                </p>
                            </div>
                        </div>

                        {arquivos.length > 0 && (
                            <div className="mt-6 space-y-3">
                                {arquivos.map((arquivo) => (
                                    <div key={arquivo.fileId} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{arquivo.originalName}</p>
                                                <p className="text-sm text-slate-500">{formatFileSize(arquivo.size)}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {arquivo.status === 'uploading' && <Loader className="animate-spin text-indigo-500" size={20} />}
                                                {arquivo.status === 'completed' && <CheckCircle className="text-green-500" size={20} />}
                                                {arquivo.status === 'error' && <AlertCircle className="text-red-500" size={20} />}
                                                <button type="button" onClick={() => removeFile(arquivo.fileId)} className="text-slate-400 hover:text-slate-600">
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                        {arquivo.status === 'uploading' && (
                                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${arquivo.progress}%` }}></div>
                                            </div>
                                        )}
                                        {arquivo.status === 'error' && arquivo.error && (
                                            <p className="text-sm text-red-600">{arquivo.error}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* AÇÃO FINAL */}
                <div className="pt-4 flex flex-col items-center">
                    <p className="text-slate-500 text-center mb-4">Lembre-se: após o envio, nenhuma alteração poderá ser desfeita.</p>
                    <button
                        className="w-full max-w-xs bg-indigo-600 text-white py-3 px-6 text-base font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
                        onClick={() => {
                            if (confirm("Ao enviar esta correção, não será possível realizar nenhuma alteração. Deseja mesmo continuar?")) {
                                sendToApi();
                            }
                        }}
                    >
                        Enviar Correção
                    </button>
                </div>
            </div>
        </div>
    );
};