// upload
'use client';

// Importações do React e Next.js
import { useCallback, useEffect, useState, useRef } from 'react';

//

import { normalizedWorkFileFormats, validateWorkFile, workSubmissionIsOpen } from '@/lib/academic-work-files';
// --- Função Auxiliar para Retry com Tipagem Correta ---
import { Clock, FileText, CheckCircle, AlertCircle, Loader, Info, UserPlus, Trash2, BookOpen, Target, Microscope, MessageSquare, Award, Hash, BookMarked, Save, ArrowLeft, X, Plus, Link, Loader2 } from 'lucide-react';
import { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import { AsyncStatePanel, StatusBanner } from '@/components/cieps';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';
import { validateAcademicWorkAuthors } from '@/lib/academic-work-submission';
import './style.css';

function createLocalUploadId(): string {
  return `file_${crypto.randomUUID()}`;
}

// Interface do Autor simplificada: O front-end não precisa saber quem é pagante.
interface Autor {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  isOrientador: boolean;
  isCurrentUser?: boolean;
}

// MODIFICAÇÃO: Interface para múltiplos arquivos por quadrado
interface ArquivoUpload {
  id: string;
  storedId?: string;
  fileName: string;
  originalName: string;
  size: number;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

type FormatoRequisito = {
  titulo: string;
  formatos: string[];
};

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


// Função para formatar tamanho do arquivo
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ===================================================================
// COMPONENTE PRINCIPAL DA PÁGINA (Apenas Autenticação e Layout)
// ===================================================================
export default function UploadPage() {
  return (
    <div className="enviar-trabalho-main">
      <div className="enviar-trabalho-container">
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
  const [autores, setAutores] = useState<Autor[]>([{ id: 0, nome: '', email: '', cpf: '', isOrientador: false }]);

  // MODIFICAÇÃO: Estado para múltiplos arquivos por quadrado
  const [slotRequisitos, setSlotRequisitos] = useState<IAcademicWorksProps["modalidades"][0]["requisitos_arquivos"]>([]);
  const [slotFiles, setSlotFiles] = useState<Array<ArquivoUpload | null>>([]);
  const slotFilesRef = useRef<Array<ArquivoUpload | null>>([]);
  const submittingRef = useRef(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [trabalhosProps, setTrabalhosProps] = useState<IAcademicWorksProps | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [topicos, setTopicos] = useState<TopicosTrabalho>({
    resumo: '', introducao: '', objetivo: '', metodo: '', discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: ''
  });

  const [isUserLogadoPagante, setIsUserLogadoPagante] = useState<boolean | null>(null);
  const [hasRemoteAccess, setHasRemoteAccess] = useState(false);
  const [participationMode, setParticipationMode] = useState<'REGULAR' | 'REMOTE'>('REGULAR');
  const [currentUserProfile, setCurrentUserProfile] = useState({ nome: '', email: '', cpf: '' });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isValidatingAuthors, setIsValidatingAuthors] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const setSlots = useCallback((next: Array<ArquivoUpload | null>) => {
    slotFilesRef.current = next;
    setSlotFiles(next);
  }, []);

  const deletePendingFile = useCallback(async (storedId: string) => {
    try {
      const response = await fetchWithTimeout('/api/delete/pendingWorkFile', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: storedId }),
      });
      await readJsonResponse(response);
    } catch {
      setFormError('O arquivo saiu do formulário, mas não foi possível removê-lo do servidor. Você pode escolher outro arquivo.');
    }
  }, []);

  const deletePendingChunks = async (chunkIds: string[]) => {
    if (!chunkIds.length) return;
    try {
      const response = await fetchWithTimeout('/api/delete/pendingWorkFile', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkIds }),
      }, 60_000);
      await readJsonResponse(response);
    } catch (error) {
      console.error('Não foi possível limpar partes de um upload interrompido:', error);
    }
  };

  const clearSlots = useCallback((count: number) => {
    for (const file of slotFilesRef.current) {
      if (file?.storedId) void deletePendingFile(file.storedId);
    }
    setSlots(Array.from({ length: count }, () => null));
  }, [deletePendingFile, setSlots]);

  // Efeito para verificar o status do usuário logado e preencher seus dados.
  useEffect(() => {
    const verificarStatusUsuario = async () => {
      setIsLoadingStatus(true);
      try {
        const responseTrabalhosProps = await fetchWithTimeout('/api/get/trabalhosConfig')
        const responseTrabalhosJson = await readJsonResponse<IAcademicWorksProps>(responseTrabalhosProps)
        if (!responseTrabalhosJson) throw new Error('A API retornou uma resposta vazia.')
        setTrabalhosProps(responseTrabalhosJson)
        const response = await fetchWithTimeout('/api/get/verificacaoUsuario');
        const data = await readJsonResponse<any>(response);
        if (!data) throw new Error('A API retornou uma resposta vazia.');
        const temPagamento = data.pagamento?.situacao === 1 || data.pagamento?.situacao_animacao === 1;
        const remoteActive = data.participacaoRemota?.status === 'ACTIVE' && data.participacaoRemota?.proofReviewStatus !== 'INCONSISTENT';
        const initialMode = remoteActive && !temPagamento ? 'REMOTE' : 'REGULAR';
        setIsUserLogadoPagante(temPagamento);
        setHasRemoteAccess(remoteActive);
        setParticipationMode(initialMode);
        const availableModalities = initialMode === 'REMOTE'
          ? responseTrabalhosJson.modalidades?.filter((item) => item.permite_participacao_remota === true)
          : responseTrabalhosJson.modalidades;
        const modalidadeSelecionada = availableModalities?.[0];
        setModalidade(modalidadeSelecionada);
        setSlotRequisitos(modalidadeSelecionada?.requisitos_arquivos ?? []);
        clearSlots(modalidadeSelecionada?.requisitos_arquivos?.length ?? 0);

        const authenticatedProfile = {
          nome: data.informacoes_usuario?.nome || data.participacaoRemota?.purchaser?.name || data.authUser?.name || '',
          email: data.informacoes_usuario?.email || data.participacaoRemota?.purchaser?.email || data.authUser?.email || '',
          cpf: data.informacoes_usuario?.cpf || data.participacaoRemota?.purchaser?.cpf || '',
        };
        setCurrentUserProfile(authenticatedProfile);

        // Preenche os dados do primeiro autor com as informações do usuário logado
        setAutores(prev => {
          const primeiroAutor = { ...prev[0] };
          primeiroAutor.nome = authenticatedProfile.nome;
          primeiroAutor.email = authenticatedProfile.email;
          primeiroAutor.cpf = authenticatedProfile.cpf;
          primeiroAutor.isCurrentUser = initialMode === 'REMOTE';
          return [primeiroAutor, ...prev.slice(1)];
        });

      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Não foi possível preparar o formulário.');
      } finally {
        setIsLoadingStatus(false)
      }
    };
    verificarStatusUsuario()
    //checkAuthStatus();
  }, [requestVersion, clearSlots]);

  // Função para atualizar progresso de um arquivo específico
  const updateFileProgress = (fileId: string, progress: number, status: ArquivoUpload['status'], error?: string) => {
    const next = slotFilesRef.current.map(arquivo => arquivo?.id === fileId
      ? { ...arquivo, progress, status, error } : arquivo);
    setSlots(next);
  };

  const uploadSingleFile = async (file: File, fileId: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('originalFileName', file.name);
    formData.append('purpose', 'submission');

    try {
      updateFileProgress(fileId, 30, 'uploading');
      const response = await fetchWithTimeout('/api/post/uploadBlobSingle', { method: 'POST', body: formData }, 120_000);
      updateFileProgress(fileId, 70, 'uploading');

      const result = await readJsonResponse<any>(response);
      if (!result) throw new Error('A API de upload retornou uma resposta vazia.');
      if (!result.data || !result.data._id) throw new Error('A API de upload não retornou um ID de arquivo válido.');

      return result.data._id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      updateFileProgress(fileId, 0, 'error', errorMessage);
      return null;
    }
  };

  const uploadChunkedFile = async (file: File, fileId: string, chunkSize: number): Promise<string | null> => {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > 10 * 1024 * 1024) {
      updateFileProgress(fileId, 0, 'error', 'Configuração de partes inválida. Atualize a página.');
      return null;
    }
    const totalChunks = Math.ceil(file.size / chunkSize);
    const chunkIds: string[] = [];
    const uniqueFileName = crypto.randomUUID();

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (!slotFilesRef.current.some(slot => slot?.id === fileId)) throw new Error('Upload cancelado.');
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', uniqueFileName);

        const response = await fetchWithTimeout('/api/post/uploadBlobChunk', { method: 'POST', body: formData }, 120_000);
        const result = await readJsonResponse<any>(response);
        if (!result) throw new Error(`A API não confirmou o chunk ${i + 1}.`);
        chunkIds.push(result.chunkId);
        updateFileProgress(fileId, ((i + 1) / totalChunks) * 90, 'uploading');
      }

      if (!slotFilesRef.current.some(slot => slot?.id === fileId)) throw new Error('Upload cancelado.');

      const reconstructResponse = await fetchWithTimeout('/api/post/reconstructBlobFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkFileName: uniqueFileName, finalFileName: uniqueFileName, originalName: file.name, purpose: 'submission', chunkIds, totalSize: file.size }),
      }, 300_000);

      const result = await readJsonResponse<any>(reconstructResponse);
      if (!result) throw new Error('A API de reconstrução retornou uma resposta vazia.');
      if (!result.data || !result.data._id) throw new Error('A API de reconstrução não retornou um ID válido.');

      return result.data._id;
    } catch (error) {
      void deletePendingChunks(chunkIds);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      updateFileProgress(fileId, 0, 'error', errorMessage);
      return null;
    }
  };

  const validateFileFormatForSlot = (slotIndex: number, file: File): string | null => {
    const req = slotRequisitos?.[slotIndex];
    if (!req) return 'Requisito ausente para este slot.';
    return validateWorkFile(file, req, modalidade?.limite_maximo_de_postagem ?? 0);
  };

  const removeSlotFile = (slotIndex: number) => {
    const slotFile = slotFilesRef.current[slotIndex];
    const next = [...slotFilesRef.current];
    next[slotIndex] = null;
    setSlots(next);
    if (slotFile?.storedId) void deletePendingFile(slotFile.storedId);
  };

  const handleSlotFileUpload = async (slotIndex: number, file: File) => {
    const req = slotRequisitos?.[slotIndex];
    if (!req) {
      setFormError('Requisito ausente para este slot.');
      return;
    }

    if (!modalidade) {
      setFormError('Selecione uma modalidade para prosseguir com o upload.');
      return;
    }

    const validationError = validateFileFormatForSlot(slotIndex, file);
    if (validationError) { setFormError(validationError); return; }
    if (slotFilesRef.current[slotIndex]) {
      removeSlotFile(slotIndex);
    }

    setFormError(null);

    const fileId = createLocalUploadId();
    const newSlotFile: ArquivoUpload = {
      id: fileId,
      fileName: file.name,
      originalName: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    };

    const next = [...slotFilesRef.current];
    next[slotIndex] = newSlotFile;
    setSlots(next);

    const uploadedFileId = file.size > modalidade.chunk_limite
      ? await uploadChunkedFile(file, fileId, modalidade.chunk_tamanho)
      : await uploadSingleFile(file, fileId);

    if (!uploadedFileId) {
      return;
    }

    if (slotFilesRef.current[slotIndex]?.id !== fileId) {
      void deletePendingFile(uploadedFileId);
      return;
    }
    const completed = [...slotFilesRef.current];
    completed[slotIndex] = { ...completed[slotIndex]!, storedId: uploadedFileId, status: 'completed', progress: 100 };
    setSlots(completed);
  };

  // Função para validar autores pagantes antes de prosseguir
  const validarAutoresPagantes = async (): Promise<boolean> => {
    setIsValidatingAuthors(true);
    setFormError(null);

    try {
      const response = await fetchWithTimeout('/api/post/submitWork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          participationMode,
          autores: autores.map(({ id, ...rest }) => rest) // Remove o ID do frontend
        }),
      });

      const result = await readJsonResponse<any>(response);
      if (!result) throw new Error('A API retornou uma resposta vazia.');

      if (!result.temPagante) {
        setFormError(participationMode === 'REMOTE'
          ? 'Seu acesso remoto precisa estar confirmado e você deve constar como autor.'
          : 'Para prosseguir, pelo menos um dos autores deve estar cadastrado no sistema com pagamento confirmado.');
        return false;
      }

      return true;
    } catch {
      setFormError('Erro ao validar autores. Tente novamente.');
      return false;
    } finally {
      setIsValidatingAuthors(false);
    }
  };

  const handleDadosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Validações básicas
    if (!titulo || !modalidade || autores.some(a => !a.nome || !a.email || !a.cpf)) {
      setFormError('Todos os campos de informações do trabalho e dos autores devem ser preenchidos.');
      return;
    }

    if (!slotRequisitos.length) {
      setFormError('Configuração de requisitos não carregada.');
      return;
    }

    if (slotFiles.length !== slotRequisitos.length || slotFiles.some(f => !f || f.status !== 'completed' || !f.storedId)) {
      setFormError('Envie e aguarde a conclusão de um arquivo para cada requisito.');
      return;
    }

    // Validação pré-envio do formato (extensão) antes de avançar
    for (let idx = 0; idx < slotFiles.length; idx++) {
      const f = slotFiles[idx];
      if (!f) continue;
      const validationError = validateWorkFile({ name: f.originalName, size: f.size }, slotRequisitos[idx], modalidade.limite_maximo_de_postagem);
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }

    const authorValidation = validateAcademicWorkAuthors(autores, modalidade);
    if (authorValidation.ok === false) {
      setFormError(authorValidation.message);
      return;
    }
    if (participationMode === 'REMOTE' && !autores.some((autor) => autor.isCurrentUser && !autor.isOrientador)) {
      setFormError('Indique qual autor corresponde ao comprador do acesso remoto.');
      return;
    }

    // Validar se há pelo menos um autor pagante antes de prosseguir
    const autoresValidos = await validarAutoresPagantes();
    if (autoresValidos) {
      setCurrentStep('topicos');
    }
  };

  const handleAddAutor = () => {
    const totalLimit = Number(modalidade?.autores_por_trabalho || 0) + Number(modalidade?.maximo_orientadores || 0);
    if (autores.length < totalLimit) {
      setAutores([...autores, { id: Date.now(), nome: '', email: '', cpf: '', isOrientador: false }]);
    }
  };

  const handleRemoveAutor = (id: number) => {
    if (autores.some((autor) => autor.id === id && autor.isCurrentUser)) {
      setFormError('Escolha outro autor como comprador antes de remover este registro.');
      return;
    }
    setAutores(autores.filter(autor => autor.id !== id));
  };

  const handleAutorChange = (id: number, field: keyof Autor, value: string | boolean) => {
    setAutores(autores.map(autor => autor.id === id ? { ...autor, [field]: value } : autor));
  };

  const handleOrientadorChange = (id: number) => {
    if (autores.some((autor) => autor.id === id && autor.isCurrentUser)) {
      setFormError('O comprador do acesso remoto deve permanecer como autor, não orientador.');
      return;
    }
    setAutores(autores.map(autor => ({ ...autor, isOrientador: autor.id === id ? !autor.isOrientador : autor.isOrientador })));
  };

  const selectModality = (selectedMode: 'REGULAR' | 'REMOTE') => {
    const available = selectedMode === 'REMOTE'
      ? trabalhosProps?.modalidades?.filter((item) => item.permite_participacao_remota === true)
      : trabalhosProps?.modalidades;
    const selected = available?.[0];
    setModalidade(selected);
    setSlotRequisitos(selected?.requisitos_arquivos ?? []);
    clearSlots(selected?.requisitos_arquivos?.length ?? 0);
  };

  const handleParticipationModeChange = (mode: 'REGULAR' | 'REMOTE') => {
    setParticipationMode(mode);
    selectModality(mode);
    setAutores((current) => current.map((author, index) => ({
      ...author,
      isCurrentUser: mode === 'REMOTE' ? author.isCurrentUser || index === 0 : false,
      ...(mode === 'REMOTE' && (author.isCurrentUser || index === 0)
        ? { nome: currentUserProfile.nome || author.nome, email: currentUserProfile.email, cpf: currentUserProfile.cpf || author.cpf, isOrientador: false }
        : {}),
    })));
  };

  const handleCurrentUserAuthorChange = (authorId: number) => {
    setAutores((current) => current.map((author) => author.id === authorId
      ? { ...author, ...currentUserProfile, isOrientador: false, isCurrentUser: true }
      : { ...author, isCurrentUser: false }));
  };

  const handleTopicoChange = (field: keyof TopicosTrabalho, value: string) => {
    setTopicos(prev => ({ ...prev, [field]: value }));
  };

  const voltarParaDados = () => {
    setCurrentStep('dados');
  };

  const handleTopicosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const currentFiles = slotFilesRef.current;
      if (currentFiles.length !== slotRequisitos.length || currentFiles.some(file => !file?.storedId || file.status !== 'completed')) {
        throw new Error('Envie todos os arquivos exigidos antes de submeter.');
      }
      const attachments = currentFiles.map((file, slotIndex) => ({ slotIndex, fileId: file!.storedId! }));

      const response = await fetchWithTimeout('/api/post/submitWork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          modalidadeId: modalidade?._id,
          autores: autores.map(({ id, ...rest }) => rest),
          clientVersion: 2,
          attachments,
          topicos,
          participationMode,
        }),
      }, 120_000);

      const result = await readJsonResponse<any>(response);
      if (!result) throw new Error('A API retornou uma resposta vazia.');
      setFormSuccess(result.message || 'Trabalho submetido com sucesso!');
      setSuccessModalOpen(true);

      // Reset do formulário
      setTitulo('');
      setSlots(Array.from({ length: slotRequisitos.length }, () => null));
      setTopicos({
        resumo: '', introducao: '', objetivo: '', metodo: '',
        discussaoResultados: '', conclusao: '', palavrasChave: '', referencias: ''
      });
      setCurrentStep('dados');

    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro desconhecido na submissão.');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (isLoadingStatus) {
    return <AsyncStatePanel status="loading" loadingTitle="Carregando configurações de trabalhos" />
  }
  if (loadError || !trabalhosProps) {
    return (
      <AsyncStatePanel
        status="error"
        errorTitle="Formulário indisponível"
        message={loadError ?? 'As configurações de submissão retornaram incompletas.'}
        onRetry={() => {
          setLoadError(null);
          setIsLoadingStatus(true);
          setRequestVersion((version) => version + 1);
        }}
      />
    )
  }
  if (!workSubmissionIsOpen(trabalhosProps)) {
    return (
      <div className='periodo-fechado'>
        <h1>O período de submissão já foi encerrado.</h1>
        <p>Caso tenha realizado alguma submissão, você pode acompanhá-la em {`"Consultar Submissões"`}.</p>
      </div>
    )
  }
  //


  if (currentStep === 'topicos') {
    return (
      <div className="formulario-principal">
        <div className="flex items-center justify-between mb-6">
          <button onClick={voltarParaDados} className="btn-voltar">
            <ArrowLeft className="mr-2" size={16} />
            Voltar
          </button>
          <h2 className="form-title">Tópicos do Trabalho</h2>
          <div></div>
        </div>

        <form onSubmit={handleTopicosSubmit} className="space-y-6">
          <div className="topicos-grid">
            <div className="md:col-span-2">
              <label htmlFor="topic-summary" className="form-label"><BookOpen className="inline mr-2" size={16} />Resumo</label>
              <textarea id="topic-summary" value={topicos.resumo} onChange={(e) => handleTopicoChange('resumo', e.target.value)} className="form-textarea" rows={4} placeholder="Digite o resumo do seu trabalho..." />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="topic-introduction" className="form-label"><BookOpen className="inline mr-2" size={16} />Introdução</label>
              <textarea id="topic-introduction" value={topicos.introducao} onChange={(e) => handleTopicoChange('introducao', e.target.value)} className="form-textarea" rows={4} placeholder="Digite a introdução do seu trabalho..." />
            </div>
            <div>
              <label htmlFor="topic-objective" className="form-label"><Target className="inline mr-2" size={16} />Objetivo</label>
              <textarea id="topic-objective" value={topicos.objetivo} onChange={(e) => handleTopicoChange('objetivo', e.target.value)} className="form-textarea" rows={3} placeholder="Qual é o objetivo do seu trabalho?" />
            </div>
            <div>
              <label htmlFor="topic-method" className="form-label"><Microscope className="inline mr-2" size={16} />Método</label>
              <textarea id="topic-method" value={topicos.metodo} onChange={(e) => handleTopicoChange('metodo', e.target.value)} className="form-textarea" rows={4} placeholder="Descreva a metodologia utilizada..." />
            </div>
            <div>
              <label htmlFor="topic-results" className="form-label"><MessageSquare className="inline mr-2" size={16} />Discussão e resultados</label>
              <textarea id="topic-results" value={topicos.discussaoResultados} onChange={(e) => handleTopicoChange('discussaoResultados', e.target.value)} className="form-textarea" rows={4} placeholder="Apresente os resultados e discussão..." />
            </div>
            <div>
              <label htmlFor="topic-conclusion" className="form-label"><Award className="inline mr-2" size={16} />Conclusão</label>
              <textarea id="topic-conclusion" value={topicos.conclusao} onChange={(e) => handleTopicoChange('conclusao', e.target.value)} className="form-textarea" rows={3} placeholder="Quais são as conclusões do trabalho?" />
            </div>
            <div>
              <label htmlFor="topic-keywords" className="form-label"><Hash className="inline mr-2" size={16} />Palavras-chave</label>
              <textarea id="topic-keywords" value={topicos.palavrasChave} onChange={(e) => handleTopicoChange('palavrasChave', e.target.value)} className="form-textarea" rows={2} placeholder="Liste as palavras-chave separadas por vírgula..." />
            </div>
            <div>
              <label htmlFor="topic-references" className="form-label"><BookMarked className="inline mr-2" size={16} />Referências</label>
              <textarea id="topic-references" value={topicos.referencias} onChange={(e) => handleTopicoChange('referencias', e.target.value)} className="form-textarea" rows={4} placeholder="Liste as referências bibliográficas..." />
            </div>
          </div>

          <div className="botoes-acoes">
            {formError && (
              <div className="mensagem-erro">
                {formError}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-secundario"
            >
              {isSubmitting ? <Loader className="animate-spin mr-2" /> : <Save className="mr-2" />}
              {isSubmitting ? 'Enviando...' : 'Finalizar Submissão'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      {successModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Submissão concluída</h3>
              <button
                type="button"
                onClick={() => {
                  setSuccessModalOpen(false);
                  window.location.reload();
                }}
                className="text-gray-600 hover:text-gray-900"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-700">
              {formSuccess ?? 'Trabalho submetido com sucesso!'}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalOpen(false);
                  window.location.reload();
                }}
                className="btn-primario"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleDadosSubmit} className="formulario-principal">
        <div className="form-header">
          <h1 className="form-title">Submissão de Trabalho</h1>
          <p className="form-subtitle">Preencha os dados abaixo e anexe os arquivos do seu trabalho.</p>
        </div>
        {formSuccess && <StatusBanner tone="success" title="Submissão concluída" className="mb-6">{formSuccess}</StatusBanner>}

        <div className="space-y-6">
          {hasRemoteAccess && isUserLogadoPagante && (
            <div className="form-group">
              <label htmlFor="participationMode" className="form-label">Modo de participação *</label>
              <select id="participationMode" className="form-select" value={participationMode} onChange={(event) => handleParticipationModeChange(event.target.value as 'REGULAR' | 'REMOTE')}>
                <option value="REGULAR">Inscrição regular</option>
                <option value="REMOTE">Apresentação remota</option>
              </select>
              <p className="mt-2 text-xs text-gray-600">O modo fica registrado neste trabalho e determina qual pagamento o autor utiliza.</p>
            </div>
          )}
          {participationMode === 'REMOTE' && (
            <StatusBanner tone="info" title="Apresentação remota">
              Disponível somente para Trabalho Completo. A taxa remota não dá acesso presencial ao congresso.
            </StatusBanner>
          )}
          <div className="form-group">
            <label htmlFor="titulo" className="form-label">
              Título do Trabalho *
            </label>
            <input
              type="text"
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="form-input"
              placeholder="Digite o título do seu trabalho"
            />
          </div>

          <div className="form-group">
            <label htmlFor="modalidade" className="form-label">
              Modalidade *
            </label>
            <select
              id="modalidade"
              // CORREÇÃO 1: Converte o ObjectId para string para o 'value' do select.
              value={modalidade?._id?.toString() || ''}
              onChange={(e) => {
                // A lógica de busca continua a mesma, pois e.target.value já é uma string.
                const selectedModalidade = trabalhosProps?.modalidades?.find(m => m._id.toString() === e.target.value);
                setModalidade(selectedModalidade);
                setSlotRequisitos(selectedModalidade?.requisitos_arquivos ?? []);
                clearSlots(selectedModalidade?.requisitos_arquivos?.length ?? 0);
              }}
              className="form-select"
            >
              {trabalhosProps?.modalidades
                ?.filter((mod) => participationMode !== 'REMOTE' || mod.permite_participacao_remota === true)
                .map((mod) => (
                // CORREÇÃO 2: Converte o ObjectId para string para as props 'key' e 'value' da option.
                <option key={mod._id.toString()} value={mod._id.toString()} className="text-gray-900">
                  {mod.modalidade}
                </option>
              ))}
            </select>
          </div>


          {/* NOVA SEÇÃO: Upload por quadrados (1 arquivo por requisito_arquivos) */}
          <div className="form-group">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="form-label">Arquivos do Trabalho *</div>
                <div className="text-xs text-gray-600 mt-1">Envie um arquivo em cada um dos {slotRequisitos.length} requisitos.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {slotRequisitos.map((req, slotIndex) => {
                const inputId = `slot-file-${slotIndex}`;
                const slotFile = slotFiles[slotIndex];
                const accept = normalizedWorkFileFormats(req.formatos).join(',');

                const statusIcon =
                  slotFile?.status === 'uploading' ? (
                    <Loader className="animate-spin text-blue-500" size={16} />
                  ) : slotFile?.status === 'completed' ? (
                    <CheckCircle className="text-green-500" size={16} />
                  ) : slotFile?.status === 'error' ? (
                    <AlertCircle className="text-red-500" size={16} />
                  ) : null;

                return (
                  <div
                    key={slotIndex}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label htmlFor={inputId} className="block">
                          <div className="text-sm font-semibold text-gray-900">
                            {slotIndex + 1} - {req.titulo}
                          </div>
                        </label>
                        <div className="text-xs text-gray-600 mt-1">
                          Formatos permitidos: {(req.formatos ?? []).join(', ')}
                        </div>
                      </div>
                      <div className="shrink-0">{statusIcon}</div>
                    </div>

                    <div className="mt-3">
                      <input
                        id={inputId}
                        type="file"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) {
                            void handleSlotFileUpload(slotIndex, f);
                          }
                        }}
                        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-gray-800 hover:file:bg-gray-200"
                        accept={accept}
                      />

                      {slotFile && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-900">{slotFile.originalName}</div>
                          <div className="text-xs text-gray-600">{formatFileSize(slotFile.size)}</div>

                          {slotFile.status === 'uploading' && (
                            <div className="mt-3">
                              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className="h-2 rounded-full bg-blue-500 transition-[width]"
                                  style={{ width: `${slotFile.progress}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-600 mt-2">Enviando... {slotFile.progress}%</div>
                            </div>
                          )}

                          {slotFile.status === 'error' && slotFile.error && (
                            <p className="text-xs text-red-600 mt-2">{slotFile.error}</p>
                          )}

                          {slotFile.status === 'completed' && (
                            <div className="text-xs text-green-600 mt-2">Upload concluído!</div>
                          )}

                          <button
                            type="button"
                            onClick={() => removeSlotFile(slotIndex)}
                            className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                            aria-label={`Remover arquivo do slot ${slotIndex + 1}`}
                          >
                            <X size={16} />
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção de autores (mantida igual) */}
          <div className="form-group">
            <div className="flex items-center justify-between mb-4">
              <span className="form-label">
                Autores * (máximo {modalidade?.autores_por_trabalho})
              </span>
              <span className="form-label">
                Orientadores * (máximo {modalidade?.maximo_orientadores})
              </span>
              <button
                type="button"
                onClick={handleAddAutor}
                disabled={autores.length >= Number(modalidade?.autores_por_trabalho || 0) + Number(modalidade?.maximo_orientadores || 0)}
                className="adicionar-autor-btn"
              >
                <UserPlus size={16} className="mr-1" />
                Adicionar autor
              </button>
            </div>

            <div className="autores-section">
              {participationMode === 'REMOTE' && (
                <label className="mb-4 block text-sm font-semibold text-gray-800">
                  Qual autor é o comprador do acesso remoto?
                  <select
                    className="form-select mt-2"
                    value={autores.find((autor) => autor.isCurrentUser)?.id ?? ''}
                    onChange={(event) => handleCurrentUserAuthorChange(Number(event.target.value))}
                  >
                    {autores.filter((autor) => !autor.isOrientador).map((autor, index) => (
                      <option key={autor.id} value={autor.id}>Autor {index + 1}{autor.nome ? ` - ${autor.nome}` : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              {autores.map((autor, index) => (
                <div key={autor.id} className="autor-item">
                  <div className="autor-header">
                    <h4 className="autor-titulo">Autor {index + 1}</h4>
                    {autores.length > 1 && !autor.isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAutor(autor.id)}
                        className="remover-autor"
                        aria-label={`Remover autor ${index + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="autor-grid">
                    <input
                      type="text"
                      aria-label={`Nome completo do autor ${index + 1}`}
                      placeholder="Nome completo"
                      value={autor.nome}
                      onChange={(e) => handleAutorChange(autor.id, 'nome', e.target.value)}
                      readOnly={autor.isCurrentUser}
                      className="form-input"
                    />
                    <input
                      type="email"
                      aria-label={`E-mail do autor ${index + 1}`}
                      placeholder="E-mail"
                      value={autor.email}
                      onChange={(e) => handleAutorChange(autor.id, 'email', e.target.value)}
                      readOnly={autor.isCurrentUser}
                      className="form-input"
                    />
                    <input
                      type="text"
                      aria-label={`CPF do autor ${index + 1}`}
                      placeholder="CPF"
                      value={autor.cpf}
                      onChange={(e) => handleAutorChange(autor.id, 'cpf', e.target.value)}
                      readOnly={autor.isCurrentUser}
                      className="form-input"
                    />
                  </div>

                  <div className="mt-3">
                    <label className="autor-checkbox">
                      <input
                        type="checkbox"
                        aria-label={`Marcar autor ${index + 1} como orientador`}
                        checked={autor.isOrientador}
                        onChange={() => handleOrientadorChange(autor.id)}
                        disabled={autor.isCurrentUser}
                        className="mr-2 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span>Este autor é orientador</span>
                    </label>
                    {autor.isCurrentUser && <p className="mt-2 text-xs font-semibold text-emerald-700">Comprador autenticado vinculado a este autor.</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="info-ajuda">
              <Info size={14} className="inline mr-1" />
              É necessário indicar pelo menos um orientador (máximo {modalidade?.maximo_orientadores}).
            </div>
          </div>
        </div>

        <div className="botoes-acoes">
          {formError && (
            <div className="mensagem-erro">
              {formError}
            </div>
          )}
          <button
            type="submit"
            disabled={isValidatingAuthors}
            className="btn-principal"
          >
            {isValidatingAuthors ? <Loader className="animate-spin mr-2" /> : <FileText className="mr-2" />}
            {isValidatingAuthors ? 'Validando...' : 'Prosseguir para Tópicos'}
          </button>
        </div>
      </form>
    </>
  );
}

