'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Info, UserPlus, Trash2, BookOpen, Target, Microscope, MessageSquare, Award, Hash, BookMarked, Save, ArrowLeft } from 'lucide-react';
import { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
// Interface do Autor simplificada: O front-end não precisa saber quem é pagante.
interface Autor {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  isOrientador: boolean;
}

// Interface para o progresso do upload.
interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error' | 'pending';
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
  throw new Error("A operação de rede falhou após múltiplas tentativas.");
}

// Componente principal da página de Upload.
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
  const [arquivoId, setArquivoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [trabalhosProps, setTrabalhosProps] = useState<IAcademicWorksProps | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
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

        //
        const responseTrabalhosJson: IAcademicWorksProps = await responseTrabalhosProps.json()
        setTrabalhosProps(responseTrabalhosJson)
        setModalidade(responseTrabalhosJson.modalidades?.[0])
        //
        //
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
        console.error(error);
        setFormError("Não foi possível carregar seus dados. Por favor, recarregue a página.");
      } finally {
        setIsLoadingStatus(false);
      }
    };
    verificarStatusUsuario();
  }, []);

  const updateProgress = (fileName: string, progress: number, status: UploadProgress['status'], error?: string) => {
    setUploadProgress({ fileName, progress, status, error });
  };

  const uploadSingleFile = async (file: File, fileName: string, onProgress: (progress: number) => void): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    const uniqueFileName = generateUniqueFileName(fileName);
    formData.append('originalFileName', uniqueFileName);

    try {
      onProgress(30);
      const response = await fetchWithRetry('/api/post/uploadBlobSingle', { method: 'POST', body: formData });
      onProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro no upload: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.data || !result.data._id) throw new Error('A API de upload não retornou um ID de arquivo válido.');
      onProgress(100);
      return result.data._id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      updateProgress(fileName, uploadProgress?.progress || 0, 'error', errorMessage);
      return null;
    }
  };

  const uploadChunkedFile = async (file: File, fileName: string, onProgress: (progress: number) => void): Promise<string | null> => {
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
        onProgress(((i + 1) / totalChunks) * 90);
      }

      const reconstructResponse = await fetchWithRetry('/api/post/reconstructBlobFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkFileName: uniqueFileName, finalFileName: uniqueFileName, chunkIds, totalSize: file.size }),
      });

      if (!reconstructResponse.ok) throw new Error('Erro na reconstrução do arquivo');

      const result = await reconstructResponse.json();
      if (!result.data || !result.data._id) throw new Error('A API de reconstrução não retornou um ID válido.');
      onProgress(100);
      return result.data._id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      updateProgress(fileName, uploadProgress?.progress || 0, 'error', errorMessage);
      return null;
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setArquivoId(null);
    setFormError(null);
    updateProgress(file.name, 0, 'pending');

    if (file.size > MAX_FILE_SIZE) {
      updateProgress(file.name, 0, 'error', 'Arquivo excede o limite de 100MB');
      return;
    }

    updateProgress(file.name, 0, 'uploading');
    const uploadFunction = file.size > CHUNK_THRESHOLD ? uploadChunkedFile : uploadSingleFile;
    const uploadedFileId = await uploadFunction(file, file.name, (progress) => updateProgress(file.name, progress, 'uploading'));

    if (uploadedFileId) {
      updateProgress(file.name, 100, 'completed');
      setArquivoId(uploadedFileId);
    }
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
    if (!arquivoId) {
      setFormError('O upload do arquivo é obrigatório.');
      return;
    }
    if (uploadProgress?.status !== 'completed') {
      setFormError('Por favor, aguarde a conclusão do upload do arquivo.');
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
      const response = await fetch('/api/post/submitWork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modalidadeId: modalidade?._id,
          titulo,
          // modalidade, não é necessário mais a modalidade, pois estamos enviando o _id, e a partir dele, faremos a validação e pegaremos o nome atualizado do banco de dados.
          autores: autores.map(({ id, ...rest }) => rest), // Envia a lista limpa, sem o ID do front-end
          fileId: arquivoId,
          topicos
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const result = await response.json();
      alert(result.message || 'Trabalho submetido com sucesso!');

      // Reset do formulário para o estado inicial
      setTitulo('');
      // setModalidade();
      setAutores([{ id: Date.now(), nome: '', email: '', cpf: '', isOrientador: false }]);
      setArquivoId(null);
      setUploadProgress(null);
      setTopicos({ resumo: '', introducao: '', objetivo: '', metodo: '', discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: '' });
      setCurrentStep('dados');

    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!trabalhosProps) {
    return <h1 className='bg-red-500 w-full text-center'>Carregando Propriedades Trabalhos</h1>
  }

  if (currentStep === 'topicos') {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tópicos do Trabalho</h1>
            <p className="text-gray-900 mt-1">Preencha os tópicos principais do seu trabalho acadêmico.</p>
          </div>
          <button type="button" onClick={voltarParaDados} className="flex items-center text-gray-900 hover:text-black px-3 py-2 rounded-md">
            <ArrowLeft size={20} className="mr-2" />
            Voltar
          </button>
        </div>

        <form onSubmit={handleTopicosSubmit} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Resumo da Submissão:</h3>
            <p className="text-sm text-gray-900">
              <strong>Título:</strong> {titulo}<br />
              <strong>Modalidade:</strong> {modalidade.modalidade}<br />
              <strong>Arquivo:</strong> {uploadProgress?.fileName}<br />
            </p>
          </div>

          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><BookOpen className="inline mr-2" size={16} />Resumo</label>
              <textarea value={topicos.resumo} onChange={(e) => handleTopicoChange('resumo', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Escreva o resumo do trabalho..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><BookOpen className="inline mr-2" size={16} />Introdução</label>
              <textarea value={topicos.introducao} onChange={(e) => handleTopicoChange('introducao', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={4} placeholder="Descreva a introdução do seu trabalho..." />
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
              <textarea value={topicos.conclusao} onChange={(e) => handleTopicoChange('conclusao', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={3} placeholder="Apresente suas conclusões..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><Hash className="inline mr-2" size={16} />Palavras-chave</label>
              <input type="text" value={topicos.palavrasChave} onChange={(e) => handleTopicoChange('palavrasChave', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" placeholder="Palavras-chave separadas por vírgula..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><BookMarked className="inline mr-2" size={16} />Referências</label>
              <textarea value={topicos.referencias} onChange={(e) => handleTopicoChange('referencias', e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" rows={6} placeholder="Liste as referências bibliográficas..." />
            </div>
          </div>

          <div className="border-t pt-6">
            {formError && (<div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{formError}</div>)}
            <button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center">
              {isSubmitting ? <Loader className="animate-spin mr-2" /> : <Save className="mr-2" />}
              {isSubmitting ? 'Submetendo...' : 'Submeter Trabalho'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Submissão de Trabalho</h1>
        <p className="text-gray-900 mt-1">Preencha as informações do seu trabalho acadêmico.</p>
      </div>

      <form onSubmit={handleDadosSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Título do Trabalho *</label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" placeholder="Digite o título do trabalho..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modalidade *</label>
            <select value={`${modalidade._id}`} onChange={(e) => setModalidade(
              trabalhosProps.modalidades.find((value) => `${value._id}` === `${e.target.value}`)
            )} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900">
              {
                trabalhosProps?.modalidades?.map((mod) => <option key={`${mod._id}`} value={`${mod._id}`}>{mod.modalidade}</option>)
              }
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload do Arquivo *</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input ref={fileInputRef} type="file" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.doc,.docx" />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">Clique para fazer upload ou arraste o arquivo aqui</p>
            <p className="text-sm text-gray-500">PDF, DOC, DOCX (máx. 100MB)</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
              Selecionar Arquivo
            </button>
          </div>

          {uploadProgress && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{uploadProgress.fileName}</span>
                <span className="text-sm text-gray-500">{uploadProgress.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.progress}%` }}></div>
              </div>
              <div className="flex items-center mt-2">
                {uploadProgress.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
                {uploadProgress.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mr-2" />}
                {uploadProgress.status === 'uploading' && <Loader className="h-4 w-4 text-blue-500 mr-2 animate-spin" />}
                <span className="text-sm text-gray-600">
                  {uploadProgress.status === 'completed' && 'Upload concluído'}
                  {uploadProgress.status === 'error' && (uploadProgress.error || 'Erro no upload')}
                  {uploadProgress.status === 'uploading' && 'Fazendo upload...'}
                  {uploadProgress.status === 'pending' && 'Aguardando...'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">Autores * (máximo {modalidade.autores_por_trabalho})</label>
            <button type="button" onClick={handleAddAutor} disabled={autores.length >= modalidade.autores_por_trabalho} className="flex items-center text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed">
              <UserPlus size={16} className="mr-1" />
              Adicionar Autor
            </button>

          </div>
          <p className='w-full text-center font-extrabold bg-red-400'>LEMBRE-SE DE ADICIONAR SEU PRÓPRIO NOME AOS AUTORES</p>

          <div className="space-y-4">
            {autores.map((autor, index) => (
              <div key={autor.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Autor {index + 1}</h4>
                  {autores.length > 1 && (
                    <button type="button" onClick={() => handleRemoveAutor(autor.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="Nome completo" value={autor.nome} onChange={(e) => handleAutorChange(autor.id, 'nome', e.target.value)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" />
                  <input type="email" placeholder="E-mail" value={autor.email} onChange={(e) => handleAutorChange(autor.id, 'email', e.target.value)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" />
                  <input type="text" placeholder="CPF" value={autor.cpf} onChange={(e) => handleAutorChange(autor.id, 'cpf', e.target.value)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900" />
                </div>
                <div className="mt-3">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={autor.isOrientador} onChange={() => handleOrientadorChange(autor.id)} className="mr-2 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                    <span className="text-sm text-gray-700">Este autor é orientador</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-sm text-gray-600 space-y-1">
            <div><Info size={14} className="inline mr-1" />É necessário indicar pelo menos um orientador (máximo {modalidade.maximo_orientadores}).</div>
            <div><Info size={14} className="inline mr-1" />Para prosseguir, pelo menos um dos autores deve estar cadastrado no sistema com pagamento confirmado.</div>
          </div>
        </div>

        <div className="border-t pt-6">
          {formError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{formError}</div>
          )}
          <button type="submit" disabled={isLoadingStatus || isValidatingAuthors} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center">
            {(isLoadingStatus || isValidatingAuthors) ? <Loader className="animate-spin mr-2" /> : <FileText className="mr-2" />}
            {isLoadingStatus ? 'Carregando...' : isValidatingAuthors ? 'Validando autores...' : 'Prosseguir para Tópicos'}
          </button>
        </div>
      </form>
    </div>
  );
}
