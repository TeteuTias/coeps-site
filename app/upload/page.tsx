'use client';


import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Loader, Info, FileUp, UserPlus, Trash2 } from 'lucide-react';


interface Autor { id: number; nome: string; email: string; cpf: string; isOrientador: boolean; }
interface TrabalhoSubmetido { _id: string; titulo: string; modalidade: string; status: string; arquivo: { fileName: string; url: string }; avaliadorComentarios?: string; }
interface UploadedFile { _id: string; name: string; url: string; }
interface UploadProgress { fileName: string; progress: number; status: 'uploading' | 'completed' | 'error' | 'pending'; error?: string; }

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

// Apenas Autenticação e Layout

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


// componente de submissao

function SubmissionForm() {
  const [titulo, setTitulo] = useState('');
  const [modalidade, setModalidade] = useState<'Artigo' | 'Banner' | 'Resumo'>('Artigo');
  const [autores, setAutores] = useState<Autor[]>([{ id: 1, nome: '', email: '', cpf: '', isOrientador: false }]);
  const [arquivoId, setArquivoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddAutor = () => {
    if (autores.length < 8) {
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
    setAutores(autores.map(autor => ({
      ...autor,
      isOrientador: autor.id === id
    })));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setArquivoId(null);
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
      updateProgress(file.name, 0, 'error', 'Falha no upload do arquivo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!titulo || !modalidade || !arquivoId || autores.some(a => !a.nome || !a.email || !a.cpf)) {
      setFormError('Todos os campos do formulário e o upload do arquivo são obrigatórios.');
      return;
    }
    if (!autores.some(a => a.isOrientador)) {
      setFormError('É necessário indicar qual dos autores é o orientador.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/post/submitWork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          modalidade,
          autores: autores.map(({ id, ...rest }) => rest),
          fileId: arquivoId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      alert('Trabalho submetido com sucesso!');
      setTitulo('');
      setModalidade('Artigo');
      setAutores([{ id: 1, nome: '', email: '', cpf: '', isOrientador: false }]);
      setArquivoId(null);
      setUploadProgress(null);

    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProgress = (fileName: string, progress: number, status: 'uploading' | 'completed' | 'error' | 'pending', error?: string) => {
    setUploadProgress({ fileName, progress, status, error });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Submissão de Trabalho</h1>
        <p className="text-gray-500 mt-1">Preencha os dados abaixo e anexe o arquivo do seu trabalho.</p>
      </div>

      {/* Dados do Trabalho */}
      <div className="space-y-6 border-t pt-6">
        <h2 className="text-xl font-semibold text-gray-700">1. Informações do Trabalho</h2>
        <div>
          <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 mb-1">Título do Trabalho</label>
          <input type="text" id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
        </div>
        <div>
          <label htmlFor="modalidade" className="block text-sm font-medium text-gray-700 mb-1">Modalidade</label>
          <select id="modalidade" value={modalidade} onChange={(e) => setModalidade(e.target.value as any)} className="w-full p-2 border rounded-md text-gray-900">
            <option value="Artigo">Artigo</option>
            <option value="Banner">Banner</option>
            <option value="Resumo">Resumo</option>
          </select>
        </div>
      </div>

      {/* Autores */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-700">2. Autores</h2>
          <button type="button" onClick={handleAddAutor} disabled={autores.length >= 8} className="flex items-center text-sm bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 disabled:bg-gray-300">
            <UserPlus size={16} className="mr-1" /> Adicionar Autor
          </button>
        </div>
        {autores.map((autor, index) => (
          <div key={autor.id} className="p-4 border rounded-lg space-y-3 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Nome Completo" value={autor.nome} onChange={(e) => handleAutorChange(autor.id, 'nome', e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
              <input type="email" placeholder="Email" value={autor.email} onChange={(e) => handleAutorChange(autor.id, 'email', e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
              <input type="text" placeholder="CPF" value={autor.cpf} onChange={(e) => handleAutorChange(autor.id, 'cpf', e.target.value)} className="w-full p-2 border rounded-md text-gray-900" required />
              <div className="flex items-center">
                <input type="radio" name="orientador" id={`orientador-${autor.id}`} checked={autor.isOrientador} onChange={() => handleOrientadorChange(autor.id)} className="h-4 w-4 text-blue-600" />
                <label htmlFor={`orientador-${autor.id}`} className="ml-2 block text-sm text-gray-900">É o orientador?</label>
              </div>
            </div>
            {autores.length > 1 && (
              <button type="button" onClick={() => handleRemoveAutor(autor.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Upload do Arquivo */}
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-semibold text-gray-700">3. Arquivo do Trabalho</h2>
        <div className="border-2 border-dashed rounded-xl p-6 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">Anexe o arquivo correspondente ao seu trabalho.</p>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium">
            Selecionar Arquivo
          </button>
          <input ref={fileInputRef} type="file" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} className="hidden" accept=".pdf,.doc,.docx" />
        </div>
        {uploadProgress && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">{uploadProgress.fileName}</span>
              {uploadProgress.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {uploadProgress.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
            {uploadProgress.status === 'uploading' && <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress.progress}%` }}></div></div>}
            {uploadProgress.status === 'error' && <div className="text-red-600 text-sm">{uploadProgress.error}</div>}
          </div>
        )}
      </div>

      {/* Submissão Final */}
      <div className="border-t pt-6">
        {formError && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">{formError}</div>}
        <button type="submit" disabled={isSubmitting || !arquivoId} className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-xl disabled:bg-gray-400 disabled:cursor-not-allowed">
          {isSubmitting ? <Loader className="animate-spin mx-auto" /> : 'Enviar Trabalho para Avaliação'}
        </button>
      </div>
    </form>
  );
}

// Funcões de Upload
async function uploadSingleFile(file: File, originalFileName: string, onProgress: (progress: number) => void): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('originalFileName', originalFileName);
  try {
    onProgress(50);
    const response = await fetchWithRetry('/api/post/uploadBlobSingle', { method: 'POST', body: formData });
    if (!response.ok) throw new Error((await response.json()).error);
    const result = await response.json();
    onProgress(100);
    return result.data._id;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function uploadChunkedFile(file: File, originalFileName: string, onProgress: (progress: number) => void): Promise<string | null> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const chunkIds: string[] = [];
  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('fileName', file.name);
      const response = await fetchWithRetry('/api/post/uploadBlobChunk', { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json()).error);
      chunkIds.push((await response.json()).chunkId);
      onProgress(((i + 1) / totalChunks) * 90);
    }
    const reconstructResponse = await fetchWithRetry('/api/post/reconstructBlobFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkFileName: file.name, finalFileName: originalFileName, chunkIds, totalSize: file.size }),
    });
    if (!reconstructResponse.ok) throw new Error((await reconstructResponse.json()).error);
    const result = await reconstructResponse.json();
    onProgress(100);
    return result.data._id;
  } catch (error) {
    console.error(error);
    return null;
  }
}
