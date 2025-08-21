'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Loader, Info, FileUp, UserPlus, Trash2, BookOpen, Target, Microscope, MessageSquare, Award, Hash, BookMarked, Save, ArrowLeft } from 'lucide-react';

interface Autor { 
  id: number; 
  nome: string; 
  email: string; 
  cpf: string; 
  isOrientador: boolean; 
}

interface TrabalhoSubmetido { 
  _id: string; 
  titulo: string; 
  modalidade: string; 
  status: string; 
  arquivo: { fileName: string; url: string }; 
  avaliadorComentarios?: string; 
}

interface UploadedFile { 
  _id: string; 
  name: string; 
  url: string; 
}

interface UploadProgress { 
  fileName: string; 
  progress: number; 
  status: 'uploading' | 'completed' | 'error' | 'pending'; 
  error?: string; 
}

interface TopicosTrabalho {
  introducao: string;
  objetivo: string;
  metodo: string;
  discussaoResultados: string;
  conclusao: string;
  palavrasChave: string;
  referencias: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const CHUNK_SIZE = 5 * 1024 * 1024;
const CHUNK_THRESHOLD = 10 * 1024 * 1024;


async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
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


export default function UploadPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch('/api/get/history');
        if (res.ok) setIsAuthenticated(true);
        else {
          setIsAuthenticated(false);
          router.push('/api/auth/login?returnTo=/upload');
        }
      } catch (error) {
        setIsAuthenticated(false);
        router.push('/api/auth/login?returnTo=/upload');
      }
    };
    checkAuthStatus();
  }, [router]);

  if (isAuthenticated === null) {
    return <div className="flex justify-center items-center min-h-screen"><Loader className="animate-spin" /></div>;
  }
  if (isAuthenticated === false) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <SubmissionForm />
      </div>
    </div>
  );
}



function SubmissionForm() {
  const [currentStep, setCurrentStep] = useState<'dados' | 'topicos'>('dados');
  const [titulo, setTitulo] = useState('');
  const [modalidade, setModalidade] = useState<'Artigo' | 'Banner' | 'Resumo'>('Artigo');
  const [autores, setAutores] = useState<Autor[]>([{ id: Date.now(), nome: '', email: '', cpf: '', isOrientador: false }]);
  const [arquivoId, setArquivoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [topicos, setTopicos] = useState<TopicosTrabalho>({
    introducao: '', objetivo: '', metodo: '', discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: ''
  });
  const MAX_AUTORES = 8;
  const MAX_ORIENTADORES = 2;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProgress = (fileName: string, progress: number, status: UploadProgress['status'], error?: string) => {
    setUploadProgress({ fileName, progress, status, error });
  };

  const uploadSingleFile = async (file: File, fileName: string, onProgress: (progress: number) => void): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      onProgress(30);
      const response = await fetchWithRetry('/api/post/upload', {
        method: 'POST',
        body: formData,
      });
      onProgress(70);

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Erro no upload: ${response.statusText}`);
      }
      if (!result.success || !result.fileId) {
        throw new Error(result.error || 'A API de upload não retornou um ID de arquivo.');
      }

      onProgress(100);
      return result.fileId;
    } catch (error) {
      console.error("Erro no upload de arquivo:", error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      updateProgress(fileName, uploadProgress?.progress || 0, 'error', errorMessage);
      return null;
    }
  };

  const uploadChunkedFile = async (file: File, fileName: string, onProgress: (progress: number) => void): Promise<string | null> => {
    console.warn("Upload em chunks não implementado, usando upload único.");
    return uploadSingleFile(file, fileName, onProgress);
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
    } else {
      setArquivoId(null);
    }
  };

  const handleDadosSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!titulo || !modalidade || autores.some(a => !a.nome || !a.email || !a.cpf)) {
      setFormError('Todos os campos de informações do trabalho e dos autores devem ser preenchidos.');
      return;
    }
    if (!arquivoId) {
      setFormError('O upload do arquivo é obrigatório. Por favor, anexe o arquivo e aguarde a conclusão.');
      return;
    }
    if (uploadProgress?.status !== 'completed') {
        setFormError('Por favor, aguarde a conclusão do upload do arquivo antes de avançar.');
        return;
    }
    if (!autores.some(a => a.isOrientador)) {
      setFormError("É necessário indicar qual dos autores é o orientador.");
      return;
    }
    const orientadoresCount = autores.filter(a => a.isOrientador).length;
    if (orientadoresCount > MAX_ORIENTADORES) {
      setFormError(`O número máximo de orientadores permitido é ${MAX_ORIENTADORES}.`);
      return;
    }
    setCurrentStep('topicos');
  };

  const handleAddAutor = () => { if (autores.length < MAX_AUTORES) { setAutores([...autores, { id: Date.now(), nome: '', email: '', cpf: '', isOrientador: false }]); } };
  const handleRemoveAutor = (id: number) => { setAutores(autores.filter(autor => autor.id !== id)); };
  const handleAutorChange = (id: number, field: keyof Autor, value: string | boolean) => { setAutores(autores.map(autor => autor.id === id ? { ...autor, [field]: value } : autor)); };
  const handleOrientadorChange = (id: number) => { setAutores(autores.map(autor => ({ ...autor, isOrientador: autor.id === id ? !autor.isOrientador : autor.isOrientador }))); };
  const handleTopicoChange = (field: keyof TopicosTrabalho, value: string) => { setTopicos(prev => ({ ...prev, [field]: value })); };
  const voltarParaDados = () => { setCurrentStep('dados'); };
  const handleTopicosSubmit = async (e: React.FormEvent) => { e.preventDefault(); setFormError(null); setIsSubmitting(true); try { const response = await fetch('/api/post/submitWork', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo, modalidade, autores: autores.map(({ id, ...rest }) => rest), fileId: arquivoId, topicos }), }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Erro ${response.status}`); } alert('Trabalho submetido com sucesso!'); setTitulo(''); setModalidade('Artigo'); setAutores([{ id: 1, nome: '', email: '', cpf: '', isOrientador: false }]); setArquivoId(null); setUploadProgress(null); setTopicos({ introducao: '', objetivo: '', metodo: '', discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: '' }); setCurrentStep('dados'); } catch (error) { setFormError(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.'); } finally { setIsSubmitting(false); } };


  if (currentStep === 'topicos') {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
        <div className="flex items-center justify-between">
          <div>
            {/* CORREÇÃO DE COR */}
            <h1 className="text-3xl font-bold text-gray-900">Tópicos do Trabalho</h1>
            <p className="text-gray-900 mt-1">Preencha os tópicos principais do seu trabalho acadêmico.</p>
          </div>
          <button
            type="button"
            onClick={voltarParaDados}
            // CORREÇÃO DE COR
            className="flex items-center text-gray-900 hover:text-black px-3 py-2 rounded-md"
          >
            <ArrowLeft size={20} className="mr-2" />
            Voltar
          </button>
        </div>

        <form onSubmit={handleTopicosSubmit} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            {/* CORREÇÃO DE COR */}
            <h3 className="font-semibold text-gray-900 mb-2">Resumo da Submissão:</h3>
            <p className="text-sm text-gray-900">
              <strong>Título:</strong> {titulo}  

              <strong>Modalidade:</strong> {modalidade}  

              <strong>Arquivo:</strong> {uploadProgress?.fileName}
            </p>
          </div>

          <div className="grid gap-6">
            <div>
              {/* CORREÇÃO DE COR (ícone mantém a cor para destaque) */}
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <BookOpen size={16} className="mr-2 text-blue-600" />
                INTRODUÇÃO
              </label>
              <textarea
                value={topicos.introducao}
                onChange={(e) => handleTopicoChange('introducao', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 min-h-[100px] resize-vertical"
                placeholder="Descreva a introdução do trabalho..."
              />
            </div>
            {/* ... Repetir a correção para todos os labels e textareas ... */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <Target size={16} className="mr-2 text-green-600" />
                OBJETIVO
              </label>
              <textarea
                value={topicos.objetivo}
                onChange={(e) => handleTopicoChange('objetivo', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 min-h-[80px] resize-vertical"
                placeholder="Descreva o objetivo do trabalho..."
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <Microscope size={16} className="mr-2 text-purple-600" />
                MÉTODO/METODOLOGIA
              </label>
              <textarea
                value={topicos.metodo}
                onChange={(e) => handleTopicoChange('metodo', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 min-h-[100px] resize-vertical"
                placeholder="Descreva a metodologia utilizada..."
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <MessageSquare size={16} className="mr-2 text-orange-600" />
                DISCUSSÃO E RESULTADOS
              </label>
              <textarea
                value={topicos.discussaoResultados}
                onChange={(e) => handleTopicoChange('discussaoResultados', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 min-h-[120px] resize-vertical"
                placeholder="Descreva os resultados e discussão..."
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <Award size={16} className="mr-2 text-red-600" />
                CONCLUSÃO
              </label>
              <textarea
                value={topicos.conclusao}
                onChange={(e) => handleTopicoChange('conclusao', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 min-h-[100px] resize-vertical"
                placeholder="Descreva as conclusões do trabalho..."
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <Hash size={16} className="mr-2 text-indigo-600" />
                PALAVRAS-CHAVE
              </label>
              <input
                type="text"
                value={topicos.palavrasChave}
                onChange={(e) => handleTopicoChange('palavrasChave', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
                placeholder="Separe as palavras-chave por ponto e vírgula (ex: palavra1; palavra2; palavra3)"
              />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-2">
                <BookMarked size={16} className="mr-2 text-gray-600" />
                REFERÊNCIAS
              </label>
              <textarea
                value={topicos.referencias}
                onChange={(e) => handleTopicoChange('referencias', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900 min-h-[120px] resize-vertical"
                placeholder="Liste as principais referências utilizadas..."
              />
            </div>
          </div>
          <div className="border-t pt-6">{formError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{formError}</div>}<button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-xl disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center">{isSubmitting ? (<Loader className="animate-spin mr-2" />) : (<Save className="mr-2" />)}{isSubmitting ? 'Enviando...' : 'Finalizar Submissão'}</button></div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleDadosSubmit} className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
      <div>
        {/* CORREÇÃO DE COR */}
        <h1 className="text-3xl font-bold text-gray-900">Submissão de Trabalho</h1>
        <p className="text-gray-900 mt-1">Preencha os dados abaixo e anexe o arquivo do seu trabalho.</p>
      </div>

      <div className="space-y-6 border-t pt-6">
        {/* CORREÇÃO DE COR */}
        <h2 className="text-xl font-semibold text-gray-900">1. Informações do Trabalho</h2>
        <div>
          <label htmlFor="titulo" className="block text-sm font-medium text-gray-900 mb-1">Título do Trabalho</label>
          <input type="text" id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
        </div>
        <div>
          <label htmlFor="modalidade" className="block text-sm font-medium text-gray-900 mb-1">Modalidade</label>
          <select id="modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value as any)} className="w-full p-2 border rounded-md text-gray-900">
            <option value="Artigo">Artigo</option>
            <option value="Banner">Banner</option>
            <option value="Resumo">Resumo</option>
          </select>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex justify-between items-center">
          {/* CORREÇÃO DE COR */}
          <h2 className="text-xl font-semibold text-gray-900">2. Autores</h2>
          <button type="button" onClick={handleAddAutor} disabled={autores.length >= MAX_AUTORES} className="flex items-center text-sm bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 disabled:bg-gray-300"><UserPlus size={16} className="mr-1" /> Adicionar Autor</button>
        </div>
        {autores.map((autor) => (
          <div key={autor.id} className="p-4 border rounded-lg space-y-3 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Nome Completo" value={autor.nome} onChange={(e) => handleAutorChange(autor.id, 'nome', e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
              <input type="email" placeholder="E-mail" value={autor.email} onChange={(e) => handleAutorChange(autor.id, 'email', e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
              <input type="text" placeholder="CPF" value={autor.cpf} onChange={(e) => handleAutorChange(autor.id, 'cpf', e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
              <div className="flex items-center">
                <input type="checkbox" id={`orientador-${autor.id}`} checked={autor.isOrientador} onChange={() => handleOrientadorChange(autor.id)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                {/* CORREÇÃO DE COR */}
                <label htmlFor={`orientador-${autor.id}`} className="ml-2 block text-sm text-gray-900">É orientador?</label>
              </div>
            </div>
            {autores.length > 1 && (<button type="button" onClick={() => handleRemoveAutor(autor.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>)}
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t pt-6">
        {/* CORREÇÃO DE COR */}
        <h2 className="text-xl font-semibold text-gray-900">3. Upload do Arquivo</h2>
        <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${uploadProgress?.status === 'uploading' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}`} onClick={() => !(uploadProgress?.status === 'uploading') && fileInputRef.current?.click()}>
          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.doc,.docx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif" disabled={uploadProgress?.status === 'uploading'} />
          <FileUp className="mx-auto h-12 w-12 text-gray-400" />
          {/* CORREÇÃO DE COR */}
          <p className="mt-2 text-sm text-gray-900">Clique para selecionar ou arraste o arquivo</p>
          <p className="text-xs text-gray-900">Tipos permitidos: PDF, DOC, DOCX, etc.</p>
        </div>
        
        {uploadProgress && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              {/* CORREÇÃO DE COR */}
              <span className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md">{uploadProgress.fileName}</span>
              <span className={`font-semibold ${uploadProgress.status === 'error' ? 'text-red-600' : 'text-gray-900'}`}>
                {uploadProgress.status === 'completed' && 'Concluído'}
                {uploadProgress.status === 'uploading' && `${Math.round(uploadProgress.progress)}%`}
                {uploadProgress.status === 'error' && 'Falhou'}
                {uploadProgress.status === 'pending' && 'Pendente'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full transition-all ${uploadProgress.status === 'error' ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${uploadProgress.progress}%` }}></div></div>
            {uploadProgress.status === 'error' && (<p className="text-red-600 text-sm mt-1 flex items-center gap-1"><AlertCircle size={16}/> {uploadProgress.error}</p>)}
            {uploadProgress.status === 'completed' && (<p className="text-green-600 text-sm mt-1 flex items-center gap-1"><CheckCircle size={16}/> Upload concluído com sucesso!</p>)}
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        {formError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center gap-2"><AlertCircle size={20} />{formError}</div>}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold text-xl transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={!arquivoId || uploadProgress?.status !== 'completed'}>Avançar para Tópicos</button>
      </div>
    </form>
  );
}
