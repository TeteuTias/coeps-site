// upload
'use client';

// Importações do React e Next.js
import { useEffect, useState, useRef } from 'react';
//

// --- Função Auxiliar para Retry com Tipagem Correta ---
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Info, UserPlus, Trash2, BookOpen, Target, Microscope, MessageSquare, Award, Hash, BookMarked, Save, ArrowLeft, X, Plus } from 'lucide-react';
import { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';

// Interface do Autor simplificada: O front-end não precisa saber quem é pagante.
interface Autor {
    id: number;
    nome: string;
    email: string;
    cpf: string;
    isOrientador: boolean;
}

// MODIFICAÇÃO: Interface para múltiplos arquivos
interface ArquivoUpload {
    id: string;
    fileName: string;
    originalName: string;
    size: number;
    status: 'uploading' | 'completed' | 'error';
    progress: number;
    error?: string;
}

// Interface para os tópicos do trabalho.
interface TopicosTrabalho {
    resumo: string;
    introducao: string;
    objetivo: string;
    metodo: string;
    discussaoResultados: string;
    conclusao: string;
    palavrasChave: string;
    referencias: string;
}


// Função para gerar um nome de arquivo único, evitando conflitos no armazenamento.
const generateUniqueFileName = (originalName: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');

    return `${nameWithoutExtension}_${timestamp}_${randomString}.${extension}`;
};

// Função para formatar tamanho do arquivo
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

// ===================================================================
// COMPONENTE PRINCIPAL DA PÁGINA (Apenas Autenticação e Layout)
// ===================================================================
export default function UploadPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                <SubmissionForm />
            </div>
        </div>
    );
}

// Componente que contém toda a lógica do formulário de submissão.
function SubmissionForm() {
    const [currentStep, setCurrentStep] = useState<'dados' | 'topicos'>('dados');
    const [titulo, setTitulo] = useState('');
    const [modalidade, setModalidade] = useState<IAcademicWorksProps["modalidades"][0]>();
    const [autores, setAutores] = useState<Autor[]>([{ id: Date.now(), nome: '', email: '', cpf: '', isOrientador: false }]);

    // MODIFICAÇÃO: Estado para múltiplos arquivos
    const [arquivos, setArquivos] = useState<ArquivoUpload[]>([]);

    const [formError, setFormError] = useState<string | null>(null);
    const [trabalhosProps, setTrabalhosProps] = useState<IAcademicWorksProps | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [topicos, setTopicos] = useState<TopicosTrabalho>({
        resumo: '', introducao: '', objetivo: '', metodo: '', discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: ''
    });

    const [isUserLogadoPagante, setIsUserLogadoPagante] = useState<boolean | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isValidatingAuthors, setIsValidatingAuthors] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Efeito para verificar o status do usuário logado e preencher seus dados.
    useEffect(() => {
        const verificarStatusUsuario = async () => {
            setIsLoadingStatus(true);
            try {
                const responseTrabalhosProps = await fetch(`/api/get/trabalhosConfig/`)
                if (!responseTrabalhosProps.ok) {
                    const error: { message: string } = await responseTrabalhosProps.json()
                    alert(error.message)
                    throw new Error(error.message)
                }

                const responseTrabalhosJson: IAcademicWorksProps = await responseTrabalhosProps.json()
                setTrabalhosProps(responseTrabalhosJson)
                setModalidade(responseTrabalhosJson.modalidades?.[0])

                const response = await fetch('/api/get/verificacaoUsuario');
                if (!response.ok) throw new Error('Falha ao verificar o status do usuário.');
                const data = await response.json();
                const temPagamento = data.pagamento?.situacao === 1 || data.pagamento?.situacao_animacao === 1;
                setIsUserLogadoPagante(temPagamento);

                // Preenche os dados do primeiro autor com as informações do usuário logado
                setAutores(prev => {
                    const primeiroAutor = { ...prev[0] };
                    primeiroAutor.nome = data.informacoes_usuario?.nome || '';
                    primeiroAutor.email = data.informacoes_usuario?.email || '';
                    primeiroAutor.cpf = data.informacoes_usuario?.cpf || '';
                    return [primeiroAutor, ...prev.slice(1)];
                });

            } catch (error) {
                //router.push('/api/auth/login?returnTo=/upload');
            } finally {
                setIsLoadingStatus(false)
            }
        };
        verificarStatusUsuario()
        //checkAuthStatus();
    }, []);

    // Função para atualizar progresso de um arquivo específico
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
        const totalChunks = Math.ceil(file.size / modalidade.chunk_tamanho);
        const chunkIds: string[] = [];
        const uniqueFileName = generateUniqueFileName(fileName);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const start = i * modalidade.chunk_tamanho;
                const end = Math.min(start + modalidade.chunk_tamanho, file.size);
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
        if (arquivos.length + files.length > modalidade.postagens_maximas) {
            setFormError(`Você pode anexar no máximo ${modalidade.postagens_maximas} arquivos por submissão.`);
            return;
        }

        // Criar objetos de arquivo para cada arquivo selecionado
        Array.from(files).forEach(file => {
            if (file.size > modalidade.limite_maximo_de_postagem) {
                setFormError(`O arquivo "${file.name}" excede o limite de ${modalidade.limite_maximo_de_postagem/1024/1024}MB.`);
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

            const uploadFunction = file.size > modalidade.chunk_limite ? uploadChunkedFile : uploadSingleFile;
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

    // Função para validar autores pagantes antes de prosseguir
    const validarAutoresPagantes = async (): Promise<boolean> => {
        setIsValidatingAuthors(true);
        setFormError(null);

        try {
            const response = await fetch('/api/post/submitWork', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'validate',
                    autores: autores.map(({ id, ...rest }) => rest) // Remove o ID do frontend
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                setFormError(errorData.error || 'Erro na validação dos autores.');
                return false;
            }

            const result = await response.json();

            if (!result.temPagante) {
                setFormError('Para prosseguir, pelo menos um dos autores deve estar cadastrado no sistema com pagamento confirmado.');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro na validação de autores:', error);
            setFormError('Erro ao validar autores. Tente novamente.');
            return false;
        } finally {
            setIsValidatingAuthors(false);
        }
    };

    const handleDadosSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validações básicas
        if (!titulo || !modalidade || autores.some(a => !a.nome || !a.email || !a.cpf)) {
            setFormError('Todos os campos de informações do trabalho e dos autores devem ser preenchidos.');
            return;
        }

        // MODIFICAÇÃO: Validar se há pelo menos um arquivo
        if (arquivos.length === 0) {
            setFormError('É obrigatório anexar pelo menos um arquivo.');
            return;
        }

        // MODIFICAÇÃO: Verificar se todos os uploads foram concluídos
        const arquivosCompletos = arquivos.filter(arquivo => arquivo.status === 'completed');
        if (arquivosCompletos.length !== arquivos.length) {
            setFormError('Por favor, aguarde a conclusão do upload de todos os arquivos.');
            return;
        }

        if (!autores.some(a => a.isOrientador)) {
            setFormError("É necessário indicar pelo menos um orientador.");
            return;
        }
        if (autores.filter(a => a.isOrientador).length > modalidade.maximo_orientadores) {
            setFormError(`O número máximo de orientadores permitido é ${modalidade.maximo_orientadores}.`);
            return;
        }

        // Validar se há pelo menos um autor pagante antes de prosseguir
        const autoresValidos = await validarAutoresPagantes();
        if (autoresValidos) {
            setCurrentStep('topicos');
        }
    };

    const handleAddAutor = () => {
        if (autores.length < modalidade?.autores_por_trabalho) {
            setAutores([...autores, { id: Date.now(), nome: '', email: '', cpf: '', isOrientador: false }]);
        }
    };

    const handleRemoveAutor = (id: number) => {
        setAutores(autores.filter(autor => autor.id !== id));
    };

    const handleAutorChange = (id: number, field: keyof Autor, value: string | boolean) => {
        setAutores(autores.map(autor => autor.id === id ? { ...autor, [field]: value } : autor));
    };

    const handleOrientadorChange = (id: number) => {
        setAutores(autores.map(autor => ({ ...autor, isOrientador: autor.id === id ? !autor.isOrientador : autor.isOrientador })));
    };

    const handleTopicoChange = (field: keyof TopicosTrabalho, value: string) => {
        setTopicos(prev => ({ ...prev, [field]: value }));
    };

    const voltarParaDados = () => {
        setCurrentStep('dados');
    };

    const handleTopicosSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setIsSubmitting(true);

        try {
            // MODIFICAÇÃO: Enviar todos os arquivos para o backend
            const arquivosCompletos = arquivos.filter(arquivo => arquivo.status === 'completed');
            if (arquivosCompletos.length === 0) {
                setFormError('Nenhum arquivo foi enviado com sucesso.');
                return;
            }

            // MODIFICAÇÃO: Enviar array de fileIds em vez de um único fileId
            const fileIds = arquivosCompletos.map(arquivo => arquivo.id);

            const response = await fetch('/api/post/submitWork', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo,
                    modalidade: modalidade?.modalidade,
                    autores: autores.map(({ id, ...rest }) => rest),
                    fileIds: fileIds, // MODIFICAÇÃO: Enviar array de IDs
                    topicos
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erro ${response.status}`);
            }

            const result = await response.json();
            alert(result.message || 'Trabalho submetido com sucesso!');

            // Reset do formulário
            setTitulo('');
            setArquivos([]);
            setTopicos({
                resumo: '', introducao: '', objetivo: '', metodo: '',
                discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: ''
            });
            setCurrentStep('dados');

        } catch (error) {
            console.error('Erro na submissão:', error);
            setFormError(error instanceof Error ? error.message : 'Erro desconhecido na submissão.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (currentStep === 'topicos') {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={voltarParaDados} className="flex items-center text-blue-600 hover:text-blue-700">
                        <ArrowLeft className="mr-2" size={16} />
                        Voltar
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900">Tópicos do Trabalho</h2>
                    <div></div>
                </div>

                <form onSubmit={handleTopicosSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2"><BookOpen className="inline mr-2" size={16} />Resumo</label>
                            <textarea value={topicos.resumo} onChange={(e) => handleTopicoChange('resumo', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Digite o resumo do seu trabalho..." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2"><BookOpen className="inline mr-2" size={16} />Introdução</label>
                            <textarea value={topicos.introducao} onChange={(e) => handleTopicoChange('introducao', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Digite a introdução do seu trabalho..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2"><Target className="inline mr-2" size={16} />Objetivo</label>
                            <textarea value={topicos.objetivo} onChange={(e) => handleTopicoChange('objetivo', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={3} placeholder="Qual é o objetivo do seu trabalho?" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2"><Microscope className="inline mr-2" size={16} />Método</label>
                            <textarea value={topicos.metodo} onChange={(e) => handleTopicoChange('metodo', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Descreva a metodologia utilizada..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2"><MessageSquare className="inline mr-2" size={16} />Discussão e Resultados</label>
                            <textarea value={topicos.discussaoResultados} onChange={(e) => handleTopicoChange('discussaoResultados', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Apresente os resultados e discussão..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2"><Award className="inline mr-2" size={16} />Conclusão</label>
                            <textarea value={topicos.conclusao} onChange={(e) => handleTopicoChange('conclusao', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={3} placeholder="Quais são as conclusões do trabalho?" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2"><Hash className="inline mr-2" size={16} />Palavras-chave</label>
                            <textarea value={topicos.palavrasChave} onChange={(e) => handleTopicoChange('palavrasChave', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={2} placeholder="Liste as palavras-chave separadas por vírgula..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2"><BookMarked className="inline mr-2" size={16} />Referências</label>
                            <textarea value={topicos.referencias} onChange={(e) => handleTopicoChange('referencias', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Liste as referências bibliográficas..." />
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        {formError && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                                {formError}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-xl disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isSubmitting ? <Loader className="animate-spin mr-2" /> : <Save className="mr-2" />}
                            {isSubmitting ? 'Enviando...' : 'Finalizar Submissão'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    if (isLoadingStatus) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[400px] bg-white p-8 rounded-2xl shadow-lg">
                <Loader className="animate-spin h-12 w-12 text-blue-600" />
                <p className="mt-4 text-gray-700">Carregando configurações...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleDadosSubmit} className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Submissão de Trabalho</h1>
                <p className="text-gray-900 mt-1">Preencha os dados abaixo e anexe os arquivos do seu trabalho.</p>
            </div>

            <div className="space-y-6">
                <div>
                    <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 mb-2">
                        Título do Trabalho *
                    </label>
                    <input
                        type="text"
                        id="titulo"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        placeholder="Digite o título do seu trabalho"
                    />
                </div>

                <div>
                    <label htmlFor="modalidade" className="block text-sm font-medium text-gray-700 mb-2">
                        Modalidade *
                    </label>
                    <select
                        id="modalidade"
                        // CORREÇÃO 1: Converte o ObjectId para string para o 'value' do select.
                        value={modalidade?._id?.toString() || ''}
                        onChange={(e) => {
                            // A lógica de busca continua a mesma, pois e.target.value já é uma string.
                            const selectedModalidade = trabalhosProps?.modalidades.find(m => m._id.toString() === e.target.value);
                            setModalidade(selectedModalidade);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                        {trabalhosProps?.modalidades.map((mod) => (
                            // CORREÇÃO 2: Converte o ObjectId para string para as props 'key' e 'value' da option.
                            <option key={mod._id.toString()} value={mod._id.toString()} className="text-gray-900">
                                {mod.modalidade}
                            </option>
                        ))}
                    </select>
                </div>


                {/* NOVA SEÇÃO: Upload de múltiplos arquivos */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Arquivos do Trabalho * (máximo {modalidade.postagens_maximas} arquivos)
                    </label>

                    {/* Área de upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
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

                        <div className="text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center mx-auto"
                                disabled={arquivos.length >= modalidade.postagens_maximas}
                            >
                                <Plus size={16} className="mr-2" />
                                {arquivos.length === 0 ? 'Selecionar arquivos' : 'Adicionar mais arquivos'}
                            </button>
                            <p className="text-sm text-gray-500 mt-2">PDF, DOC ou DOCX até {modalidade.limite_maximo_de_postagem/1024/1024}MB cada</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {arquivos.length}/{modalidade.postagens_maximas} arquivos selecionados
                            </p>
                        </div>
                    </div>

                    {/* Lista de arquivos */}
                    {arquivos.length > 0 && (
                        <div className="mt-4 space-y-3">
                            <h4 className="font-medium text-gray-900">Arquivos anexados:</h4>
                            {arquivos.map((arquivo, index) => (
                                <div key={arquivo.id} className={`bg-gray-50 p-4 rounded-lg`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {arquivo.originalName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(arquivo.size)}
                                            </p>
                                        </div>

                                        <div className="flex items-center space-x-2">
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
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Barra de progresso */}
                                    {arquivo.status === 'uploading' && (
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
                                        <span className={`text-xs ${arquivo.status === 'completed' ? 'text-green-600' :
                                            arquivo.status === 'error' ? 'text-red-600' : 'text-blue-600'
                                            }`}>
                                            {arquivo.status === 'uploading' && `Enviando... ${arquivo.progress}%`}
                                            {arquivo.status === 'completed' && 'Upload concluído!'}
                                            {arquivo.status === 'error' && 'Erro no upload'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Seção de autores (mantida igual) */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            Autores * (máximo {modalidade?.autores_por_trabalho})
                        </label>
                        <label className="block text-sm font-medium text-gray-700">
                            Orientadores * (máximo {modalidade?.maximo_orientadores})
                        </label>
                        <button
                            type="button"
                            onClick={handleAddAutor}
                            disabled={autores.length >= (modalidade?.autores_por_trabalho)}
                            className="flex items-center text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <UserPlus size={16} className="mr-1" />
                            Adicionar Autor
                        </button>
                    </div>

                    <div className="space-y-4">
                        {autores.map((autor, index) => (
                            <div key={autor.id} className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900">Autor {index + 1}</h4>
                                    {autores.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAutor(autor.id)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Nome completo"
                                        value={autor.nome}
                                        onChange={(e) => handleAutorChange(autor.id, 'nome', e.target.value)}
                                        className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                    />
                                    <input
                                        type="email"
                                        placeholder="E-mail"
                                        value={autor.email}
                                        onChange={(e) => handleAutorChange(autor.id, 'email', e.target.value)}
                                        className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                    />
                                    <input
                                        type="text"
                                        placeholder="CPF"
                                        value={autor.cpf}
                                        onChange={(e) => handleAutorChange(autor.id, 'cpf', e.target.value)}
                                        className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                    />
                                </div>

                                <div className="mt-3">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={autor.isOrientador}
                                            onChange={() => handleOrientadorChange(autor.id)}
                                            className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Este autor é orientador</span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                        <Info size={14} className="inline mr-1" />
                        É necessário indicar pelo menos um orientador (máximo {modalidade?.maximo_orientadores}).
                    </div>
                </div>
            </div>

            <div className="border-t pt-6">
                {formError && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                        {formError}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={isValidatingAuthors}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isValidatingAuthors ? <Loader className="animate-spin mr-2" /> : <FileText className="mr-2" />}
                    {isValidatingAuthors ? 'Validando...' : 'Prosseguir para Tópicos'}
                </button>
            </div>
        </form>
    );
}

