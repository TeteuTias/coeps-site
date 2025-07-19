'use client'
import React, { useState, useEffect } from 'react';
import WarningModal from "@/components/WarningModal";
import { IUser } from "@/app/lib/types/user/user.t";
import {
  Loader2,
  User,
  Lock,
  Phone,
  CreditCard,
  Settings,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import './style.css';

const MinhasInformacoes = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingModal, setLoadingModal] = useState<boolean>(false);
  const [DATA, setData] = useState<IUser["informacoes_usuario"] | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [isModal, setIsModal] = useState<boolean>(false);

  useEffect(() => {
    const enviarRequisicaoGet = async () => {
      try {
        const response = await fetch('/api/get/usuariosConfig', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Falha ao enviar a requisição GET');
        }
        
        const responseData: IUser["informacoes_usuario"] = await response.json();
        setData(responseData);
      } catch (error) {
        console.error('Erro ao enviar a requisição GET:', error);
      } finally {
        setLoading(false);
      }
    };
    
    enviarRequisicaoGet();
  }, []);

  const closeModalMessage = (e: number) => {
    setIsModal(e === 0);
  };

  const updateData = async (update: { [key: string]: string }) => {
    if (Object.values(update)[0].trim() === "") {
      setMessage("Preencha o campo antes de realizar a atualização.");
      setIsModal(true);
      return undefined;
    }

    try {
      setLoadingModal(true);
      
      const response = await fetch('/api/put/usuarioConfig', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(update),
      });
      
      const responseJson = await response.json();
      
      if (!response.ok) {
        setMessage(responseJson.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro continue, entre em contato com a equipe COEPS.");
        setIsModal(true);
        return undefined;
      }
      
      setMessage(responseJson.message);
      setIsModal(true);
      setData(prev => ({
        ...prev,
        ...update
      }));
    } catch (erro) {
      console.log(erro);
    } finally {
      setLoadingModal(false);
    }
  };

  return (
    <div className="informacoes-main">
      <WarningModal 
        message={message} 
        isModal={isModal} 
        closeModal={closeModalMessage} 
        textButton={""} 
        onClose={function (): void {
          throw new Error("Function not implemented.")
        }} 
      />
      
      <LoadingModal isLoading={loadingModal} />

      {/* Header */}
      <section className="informacoes-header">
        <div className="header-content">
          <h1 className="header-title">MINHAS INFORMAÇÕES</h1>
        </div>
      </section>

      {/* Seção de introdução */}
      <section className="glass-container informacoes-intro">
        <h1 className="section-title">CONFIGURAÇÕES DE USUÁRIO</h1>
        <p className="intro-text">
          Gerencie suas informações pessoais e mantenha seus dados sempre atualizados. 
          Aqui você pode alterar seu nome, CPF, telefone e senha de forma segura e rápida.
        </p>
      </section>

      {/* Seção de status */}
      <section className="status-section">
        <div className="status-container glass-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner">
                <Loader2 className="spinner-icon" />
              </div>
              <h2 className="loading-text">CARREGANDO INFORMAÇÕES</h2>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : (
            <div className="details-container">
              <div className="details-icon">
                <Settings className="info-icon" />
              </div>
              <h2 className="details-text">INFORMAÇÕES CARREGADAS</h2>
              <p className="details-subtext">Suas informações foram carregadas com sucesso! Você pode editá-las abaixo.</p>
            </div>
          )}
        </div>
      </section>

      {/* Seção de formulários */}
      <section className="forms-section">
        <div className="forms-container">
          <FormCard 
            label="Nome" 
            placeholder={DATA?.nome ?? ""} 
            labelButton="Atualizar Nome" 
            loading={loading} 
            onClick={updateData} 
            nomeCampo="nome" 
            type="text"
            icon={<User size={20} />}
          />
          
          <PasswordCard 
            label="Alterar Senha" 
            labelButton="Alterar Senha" 
            loading={loading} 
          />
          
          <FormCard 
            label="CPF" 
            placeholder={DATA?.cpf ?? ""} 
            labelButton="Atualizar CPF" 
            loading={loading} 
            type="number" 
            onClick={updateData} 
            nomeCampo="cpf"
            icon={<CreditCard size={20} />}
          />
          
          <FormCard 
            label="Telefone WhatsApp" 
            placeholder={DATA?.numero_telefone ?? ""} 
            labelButton="Atualizar Telefone" 
            loading={loading} 
            type="number" 
            onClick={updateData} 
            nomeCampo="numero_telefone"
            icon={<Phone size={20} />}
          />
        </div>
      </section>
    </div>
  );
};

// Modal de carregamento
const LoadingModal = ({ isLoading = true }: { isLoading: boolean }) => {
  if (!isLoading) return null;

  return (
    <div className="loading-modal">
      <div className="loading-modal-content">
        <Loader2 className="loading-modal-spinner" />
        <p className="loading-modal-text">Carregando...</p>
      </div>
    </div>
  );
};

// Componente de formulário
const FormCard = ({ 
  label, 
  placeholder, 
  labelButton, 
  loading, 
  type = 'text', 
  onClick, 
  nomeCampo,
  icon
}: {
  label: string;
  placeholder: string;
  labelButton: string;
  loading: boolean;
  type: 'text' | 'password' | 'email' | 'number' | 'date';
  onClick: (update: { [key: string]: string }) => Promise<void>;
  nomeCampo: string;
  icon: React.ReactNode;
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  if (loading) {
    return (
      <div className="form-card">
        <div className="form-header">
          <div className="form-icon">
            {icon}
          </div>
          <h3 className="form-title">CARREGANDO...</h3>
        </div>
        <div className="form-content">
          <div className="form-group">
            <div className="form-label animate-pulse bg-gray-300 h-6 rounded"></div>
            <div className="form-input animate-pulse bg-gray-200 h-12 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-card">
      <div className="form-header">
        <div className="form-icon">
          {icon}
        </div>
        <h3 className="form-title">{label}</h3>
      </div>
      <div className="form-content">
        <div className="form-group">
          <label className="form-label">{label}</label>
          <input
            type={type}
            placeholder={placeholder}
            className="form-input"
            value={inputValue}
            onChange={handleInputChange}
          />
        </div>
        <button 
          className="form-button"
          onClick={() => {
            onClick({ [nomeCampo]: inputValue });
            setInputValue("");
          }}
          disabled={!inputValue.trim()}
        >
          <Save size={18} style={{ marginRight: '8px' }} />
          {labelButton}
        </button>
      </div>
    </div>
  );
};

// Componente de alteração de senha
const PasswordCard = ({ 
  label, 
  labelButton, 
  loading 
}: { 
  label: string; 
  labelButton: string; 
  loading: boolean; 
}) => {
  const [modal, setModal] = useState<string>("");

  if (loading) {
    return (
      <div className="password-card">
        <div className="password-header">
          <div className="password-icon">
            <Lock size={20} />
          </div>
          <h3 className="password-title">CARREGANDO...</h3>
        </div>
        <div className="form-content">
          <div className="form-group">
            <div className="form-label animate-pulse bg-gray-300 h-6 rounded"></div>
            <div className="form-input animate-pulse bg-gray-200 h-12 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PasswordWarningModal 
        isModal={modal.length > 0} 
        closeModal={() => setModal("")} 
        message={modal} 
        textButton="Obrigado(a)" 
        onClose={() => {}} 
      />
      
      <div className="password-card">
        <div className="password-header">
          <div className="password-icon">
            <Lock size={20} />
          </div>
          <h3 className="password-title">{label}</h3>
        </div>
        <div className="form-content">
          <p className="intro-text">
            Para alterar sua senha, entre em contato com a equipe COEPS através do email: dadg.imepac@gmail.com ou pelo WhatsApp: (15) 98812-3011
          </p>
          <button 
            className="password-button"
            onClick={() => setModal("Para alterar sua senha, entre em contato com a equipe COEPS através do email: dadg.imepac@gmail.com ou pelo WhatsApp: (15) 98812-3011")}
          >
            <AlertCircle size={18} style={{ marginRight: '8px' }} />
            {labelButton}
          </button>
        </div>
      </div>
    </>
  );
};

// Modal de aviso para senha
const PasswordWarningModal = ({ 
  message, 
  textButton, 
  onClose, 
  closeModal, 
  isModal 
}: { 
  message: string; 
  textButton: string; 
  onClose: () => void; 
  closeModal: () => void; 
  isModal: boolean; 
}) => {
  if (!isModal) return null;

  return (
    <div className="loading-modal">
      <div className="loading-modal-content">
        <div className="form-content">
          <div className="form-header">
            <div className="form-icon">
              <AlertCircle size={20} />
            </div>
            <h3 className="form-title">Aviso</h3>
          </div>
          <p className="intro-text">{message}</p>
          <button 
            className="form-button"
            onClick={() => {
              closeModal();
              onClose();
            }}
          >
            <CheckCircle size={18} style={{ marginRight: '8px' }} />
            {textButton}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MinhasInformacoes;