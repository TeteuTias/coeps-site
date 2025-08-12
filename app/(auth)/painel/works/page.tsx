'use client';

import { useEffect, useState } from 'react';
import { Loader, FileText, AlertTriangle, CheckCircle, Clock, MessageSquare, Download, X } from 'lucide-react';
import Link from 'next/link';

interface TrabalhoSubmetido {
  _id: string;
  titulo: string;
  modalidade: string;
  status: 'Em Avaliação' | 'Aceito' | 'Recusado' | 'Necessita de Alteração';
  arquivo: {
    fileName: string;
    url:string;
  };
  avaliadorComentarios?: string;
  dataSubmissao: string;
}


function ModalComentarios({ trabalho, onClose }: { trabalho: TrabalhoSubmetido; onClose: () => void }) {

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={onClose} 
    >
      {/* O container branco do modal */}
      <div 
        className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full m-4"
        onClick={handleModalContentClick}
      >
        <div className="flex items-start mb-4">
          <MessageSquare size={24} className="text-yellow-600 mr-3" />
          <div>
            <h3 className="text-xl font-bold text-gray-800">Comentários do Avaliador</h3>
            <p className="text-sm text-gray-500">Para o trabalho: "{trabalho.titulo}"</p>
          </div>
        </div>
        
        {/* A área de texto com os comentários */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-gray-700 text-sm">
          {trabalho.avaliadorComentarios || "Nenhum comentário fornecido."}
        </div>

        {/* Botão para fechar o modal */}
        <div className="mt-6 text-right">
          <button 
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}



const StatusBadge = ({ status }: { status: TrabalhoSubmetido['status'] }) => {
    
    const statusConfig = {
        'Em Avaliação': { icon: <Clock size={16} />, color: 'bg-blue-100 text-blue-800' },
        'Aceito': { icon: <CheckCircle size={16} />, color: 'bg-green-100 text-green-800' },
        'Recusado': { icon: <X size={16} />, color: 'bg-red-100 text-red-800' },
        'Necessita de Alteração': { icon: <AlertTriangle size={16} />, color: 'bg-yellow-100 text-yellow-800' },
    };
    const config = statusConfig[status] || statusConfig['Em Avaliação'];
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        <span className="ml-1.5">{status}</span>
        </span>
    );
};

export default function MeusTrabalhosPage() {
  const [trabalhos, setTrabalhos] = useState<TrabalhoSubmetido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  
  const [trabalhoModal, setTrabalhoModal] = useState<TrabalhoSubmetido | null>(null);

  useEffect(() => {
    const fetchTrabalhos = async () => {
      try {
        const response = await fetch('/api/get/myWorks');
        if (!response.ok) throw new Error('Falha ao carregar os trabalhos.');
        const data = await response.json();
        setTrabalhos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrabalhos();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-gray-500" size={48} /></div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meus Trabalhos Enviados</h1>
        <p className="mt-2 text-sm text-gray-600">Acompanhe o status de suas submissões e veja os comentários dos avaliadores.</p>
      </div>

      {trabalhos.length === 0 ? (
        <div className="text-center bg-white p-12 rounded-lg shadow-sm">
          <FileText size={48} className="mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum trabalho submetido</h3>
          <p className="mt-1 text-sm text-gray-500">Você ainda não enviou nenhum trabalho.</p>
          <Link href="/upload"><button className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Submeter Novo Trabalho</button></Link>
        </div>
      ) : (
        <div className="space-y-6">
          {trabalhos.map((trabalho) => (
            <div key={trabalho._id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start">
                <div className="flex-1">
                  <span className="text-xs font-semibold uppercase text-gray-500">{trabalho.modalidade}</span>
                  <h2 className="text-xl font-semibold text-gray-800">{trabalho.titulo}</h2>
                  <p className="text-sm text-gray-500 mt-1">Enviado em: {new Date(trabalho.dataSubmissao).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-6"><StatusBadge status={trabalho.status} /></div>
              </div>

              <div className="mt-4 border-t pt-4 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText size={18} className="text-gray-500" />
                  <span className="ml-2 text-sm text-gray-700">{trabalho.arquivo.fileName}</span>
                </div>
                <div className="flex items-center space-x-4">
                  {/* 👇 Botão para abrir o modal de comentários */}
                  {trabalho.status === 'Necessita de Alteração' && (
                    <button 
                      onClick={() => setTrabalhoModal(trabalho)}
                      className="flex items-center text-sm text-yellow-600 hover:text-yellow-800 font-medium"
                    >
                      <MessageSquare size={16} className="mr-1" />
                      Ver Comentários
                    </button>
                  )}
                  <a href={trabalho.arquivo.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium">
                    <Download size={16} className="mr-1" />
                    Baixar
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 👇 Renderiza o modal se um trabalho for selecionado */}
      {trabalhoModal && (
        <ModalComentarios 
          trabalho={trabalhoModal} 
          onClose={() => setTrabalhoModal(null)} 
        />
      )}
    </div>
  );
}
