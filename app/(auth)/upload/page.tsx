'use client';

// Importações do React e Next.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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
      } catch (error) {
        setIsAuthenticated(false);
        router.push('/api/auth/login?returnTo=/upload');
      }
    };
    checkAuthStatus();
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <Loader className="h-8 w-8 text-gray-400 animate-spin" />
        <p className="ml-4 text-gray-600">Verificando...</p>
      </div>
    );
  }

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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
