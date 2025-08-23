'use client';

// Importações do React e Next.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
<<<<<<< Updated upstream

// Importações de ícones
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Loader, Info, FileUp } from 'lucide-react';

// --- Interfaces e Constantes ---
interface UploadedFile {
  _id: string;
  name: string;
  url: string;
  pathname: string;
  user_id: string;
  size: number;
  uploadDate: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error' | 'pending';
  error?: string;
  previewUrl?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const CHUNK_THRESHOLD = 10 * 1024 * 1024; // 10MB - Limite para iniciar o chunking

// --- Função Auxiliar para Retry com Tipagem Correta ---
=======
import { useUser } from '@auth0/nextjs-auth0/client';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Info, UserPlus, Trash2, BookOpen, Target, Microscope, MessageSquare, Award, Hash, BookMarked, Save, ArrowLeft, X, Plus } from 'lucide-react';
import { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import { isTodayBetweenDates } from '@/lib/isTodayBetweenDates';

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

// Constantes de configuração para o upload.
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const CHUNK_THRESHOLD = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5; // NOVO: Máximo de arquivos por submissão

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
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  const [showUploader, setShowUploader] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch('/api/get/history');
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push('/api/auth/login?returnTo=/upload');
        }
=======
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

>>>>>>> Stashed changes
      } catch (error) {
        setIsAuthenticated(false);
        router.push('/api/auth/login?returnTo=/upload');
      }
    };
    checkAuthStatus();
  }, [router]);

<<<<<<< Updated upstream
  if (isAuthenticated === null) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Loader className="h-8 w-8 text-gray-400 animate-spin" />
        <p className="ml-4 text-gray-600">Verificando...</p>
=======
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
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunkIds: string[] = [];
    const uniqueFileName = generateUniqueFileName(fileName);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
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
    if (arquivos.length + files.length > MAX_FILES) {
      setFormError(`Você pode anexar no máximo ${MAX_FILES} arquivos por submissão.`);
      return;
    }

    // Criar objetos de arquivo para cada arquivo selecionado
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        setFormError(`O arquivo "${file.name}" excede o limite de 100MB.`);
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

      const uploadFunction = file.size > CHUNK_THRESHOLD ? uploadChunkedFile : uploadSingleFile;
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
>>>>>>> Stashed changes
      </div>
    );
  }

<<<<<<< Updated upstream
  if (isAuthenticated === false) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {!showUploader ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center animate-fade-in">
            <Info className="mx-auto h-16 w-16 text-blue-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Submissão de Trabalhos</h1>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Bem-vindo. Certifique-se de que seu arquivo está no formato correto antes de continuar.
            </p>
            <button 
              onClick={() => setShowUploader(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-transform transform hover:scale-105"
            >
              <FileUp className="inline-block mr-2" />
              Iniciar Envio
            </button>
          </div>
        ) : (
          <UploaderInterface />
        )}
      </div>
    </div>
  );
}

// ===================================================================
// COMPONENTE PARA A INTERFACE DE UPLOAD (Com toda a sua lógica)
// ===================================================================
function UploaderInterface() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/get/history');
        if (response.ok) {
          setUploadedFiles(await response.json());
        }
      } catch (error) {
        console.error("Falha ao carregar histórico:", error);
      }
    };
    fetchHistory();
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const updateProgress = (fileName: string, progress: number, status: 'uploading' | 'completed' | 'error' | 'pending', error?: string, previewUrl?: string) => {
    setUploadProgress(prev => {
      const existingIndex = prev.findIndex(p => p.fileName === fileName);
      if (existingIndex > -1) {
        return prev.map((p, index) =>
          index === existingIndex ? { ...p, progress, status, error: error || p.error, previewUrl: previewUrl || p.previewUrl } : p
        );
      }
      return [...prev, { fileName, progress, status, error, previewUrl }];
    });
  };

  const uploadSingleFile = async (file: File, originalFileName: string): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('originalFileName', originalFileName);
    try {
      const response = await fetchWithRetry('/api/post/uploadBlobSingle', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro no upload');
      }
      const result = await response.json();
      updateProgress(originalFileName, 100, 'completed');
      setUploadedFiles(prevState => [result.data, ...prevState]);
    } catch (error) {
      updateProgress(originalFileName, 0, 'error', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  const uploadChunkedFile = async (file: File, originalFileName: string): Promise<void> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunkIds: string[] = [];
    const chunkFileName = file.name;
    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', chunkFileName);
        const response = await fetchWithRetry('/api/post/uploadBlobChunk', { method: 'POST', body: formData });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro no upload do chunk ${chunkIndex + 1}`);
        }
        const result = await response.json();
        chunkIds.push(result.chunkId);
        updateProgress(originalFileName, ((chunkIndex + 1) / totalChunks) * 90, 'uploading');
      }
      const reconstructResponse = await fetchWithRetry('/api/post/reconstructBlobFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkFileName, finalFileName: originalFileName, chunkIds, totalSize: file.size }),
      });
      if (!reconstructResponse.ok) {
        const errorData = await reconstructResponse.json();
        throw new Error(errorData.error || 'Erro na reconstrução');
      }
      const result = await reconstructResponse.json();
      updateProgress(originalFileName, 100, 'completed');
      setUploadedFiles(prevState => [result.data, ...prevState]);
    } catch (error) {
      updateProgress(originalFileName, 0, 'error', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  const handleFileUpload = async (files: FileList): Promise<void> => {
    for (const file of Array.from(files)) {
      const originalFileName = file.name;
      const fileToUpload = file;
      updateProgress(originalFileName, 0, 'pending');
      if (fileToUpload.size > MAX_FILE_SIZE) {
        updateProgress(originalFileName, 0, 'error', 'Arquivo excede o limite de 100MB');
        continue;
      }
      updateProgress(originalFileName, 0, 'uploading');
      if (fileToUpload.size > CHUNK_THRESHOLD) {
        await uploadChunkedFile(fileToUpload, originalFileName);
      } else {
        await uploadSingleFile(fileToUpload, originalFileName);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files); }, [handleFileUpload]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFileUpload(e.target.files); };
  const removeProgress = (fileName: string) => setUploadProgress(prev => prev.filter(p => p.fileName !== fileName));
  const removeUploadedFile = (fileId: string) => setUploadedFiles(prev => prev.filter(f => f._id !== fileId));

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Upload de Trabalhos</h1>
        <p className="text-gray-600">Arraste e solte ou clique para selecionar os arquivos.</p>
      </div>
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}`}
        onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700">Arraste e solte seus arquivos aqui</h3>
        <p className="text-gray-500 mb-6">ou clique no botão abaixo</p>
        <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
            Selecionar Arquivos
        </button>
        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
      </div>

      {uploadProgress.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Progresso do Upload</h3>
          <div className="space-y-4">
            {uploadProgress.map((p) => (
              <div key={p.fileName} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2"><FileText className="h-5 w-5 text-gray-500" /><span className="font-medium text-gray-700">{p.fileName}</span></div>
                  <div className="flex items-center space-x-2">
                    {p.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {p.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    <button onClick={() => removeProgress(p.fileName)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                {p.status === 'uploading' && (<div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${p.progress}%` }}></div></div>)}
                {p.status === 'error' && <div className="text-red-600 text-sm">{p.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {uploadedFiles.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Seus Envios Recentes</h3>
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div key={file._id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3"><FileText className="h-6 w-6 text-blue-500" />
                  <div>
                    <div className="font-medium text-gray-800">{file.name}</div>
                    <div className="text-sm text-gray-500">{formatFileSize(file.size)} • {new Date(file.uploadDate).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 p-2 rounded-lg hover:bg-blue-50" title="Baixar"><Download className="h-4 w-4" /></a>
                  <button onClick={() => removeUploadedFile(file._id)} className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50" title="Remover"><X className="h-4 w-4" /></button>
=======
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
            Arquivos do Trabalho * (máximo {MAX_FILES} arquivos)
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
                disabled={arquivos.length >= MAX_FILES}
              >
                <Plus size={16} className="mr-2" />
                {arquivos.length === 0 ? 'Selecionar arquivos' : 'Adicionar mais arquivos'}
              </button>
              <p className="text-sm text-gray-500 mt-2">PDF, DOC ou DOCX até 100MB cada</p>
              <p className="text-xs text-gray-400 mt-1">
                {arquivos.length}/{MAX_FILES} arquivos selecionados
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
                    <span className={`text-xs ${
                      arquivo.status === 'completed' ? 'text-green-600' : 
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
              Autores * (máximo {modalidade?.autores_por_trabalho || 8})
            </label>
            <button
              type="button"
              onClick={handleAddAutor}
              disabled={autores.length >= (modalidade?.autores_por_trabalho || 8)}
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
>>>>>>> Stashed changes
                </div>
              </div>
            ))}
          </div>
<<<<<<< Updated upstream
        </div>
      )}
    </div>
=======

          <div className="mt-2 text-sm text-gray-600">
            <Info size={14} className="inline mr-1" />
            É necessário indicar pelo menos um orientador (máximo {modalidade?.maximo_orientadores || 2}).
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
>>>>>>> Stashed changes
  );
}

