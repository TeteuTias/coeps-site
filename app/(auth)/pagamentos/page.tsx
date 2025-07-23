'use client'
import 'react-credit-cards-2/dist/es/styles-compiled.css';
import { useUser } from "@auth0/nextjs-auth0/client"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation';
import Link from "next/link";
import HeaderPainel from "@/components/HeaderPainel";
import Cards from 'react-credit-cards-2';
import { ILecture } from '@/lib/types/events/event.t';
import { IUser } from "@/app/lib/types/user/user.t"
import { IPaymentConfig } from '@/lib/types/payments/payment.t';
import {
  Loader2,
  CreditCard,
  DollarSign,
  Receipt,
  QrCode,
  Calendar,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  ArrowRight
} from 'lucide-react';
import './style.css';

const Pagamentos = () => {
    const { user, isLoading } = useUser();
  const route = useRouter();
  const [isLoadingFetch, setIsLoadingFetch] = useState<boolean>(false);
  const [isLoadingPaymentData, setIsLoadingPaymentData] = useState<boolean>(true);
  const [dataPaymentConfig, setDataPaymentConfig] = useState<IPaymentConfig | undefined>(undefined);
  const [isModalError, setIsModalError] = useState<string | false>(false);
  const [data, setData] = useState<{ pagamento: IUser["pagamento"] }>(undefined);
  const [isFetchingData, setIsFetchingData] = useState<boolean>(true);
  const [isModalPayment, setModalPayment] = useState<boolean>(false);

  const handleData = (event: any) => {
    setData(event);
  };

  const handleIsFetchingData = (event: boolean) => {
    setIsFetchingData(event);
  };

  const handleIsModalError = (event: string | false) => {
    setIsModalError(event);
  };

  const handleIsLoadingFetch = (event: boolean) => {
    setIsLoadingFetch(event);
  };

    const handlePostClick = async () => {
    handleIsLoadingFetch(true);
        try {
            const data = {
                title: 'Título do Post',
                body: 'Conteúdo do Post',
                userId: 1,
            };

            const response = await fetch('/api/payment/create_payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                    throw new Error('Falha ao enviar a requisição POST');
      }

      const responseData: { link: string } = await response.json();
      route.push(responseData.link);
        } catch (error) {
            console.error('Erro ao enviar a requisição POST:', error);
      handleIsLoadingFetch(false);
      handleIsModalError("Ocorreu algum erro. Tente novamente mais tarde.");
    }
  };

    const handlePostClick2 = async () => {
    handleIsLoadingFetch(true);
    try {
      if (!data || !data.pagamento.lista_pagamentos || data?.pagamento?.lista_pagamentos?.length === 0) {
        console.log("ERROR: !Data || !data.lista_pagamentos");
      }
      const statusFiltro = ["PENDING"];
      const filtroLinks = data.pagamento.lista_pagamentos.filter(item => statusFiltro.includes(item.status)).map(item => item.invoiceUrl)[0];
      handleIsLoadingFetch(false);
      route.push(filtroLinks);
    } catch (error) {
      console.log("ERROR: CATCH HANDLEPOSTCLICK2");
      console.log(error);
      handleIsLoadingFetch(false);
    }
  };

    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                const response = await fetch("/api/get/usuariosPagamentos", {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
          console.log(response);
                    throw new Error('Falha ao enviar a requisição GET');
                }

                const responseData: { data: { pagamento: IUser["pagamento"] } } = await response.json();
                console.log('Resposta da requisição GET:', responseData);

        handleIsFetchingData(false);
        handleData(responseData.data);
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);
            }
        };
    
        if (!isLoading) {
            enviarRequisicaoGet();
        }
    }, [isLoading, user]);

    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                const response = await fetch("/api/payment/paymentConfigs", {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
          console.log(response);
                    throw new Error('Falha ao enviar a requisição GET');
                }

                const responseData: IPaymentConfig = await response.json();
        setDataPaymentConfig(responseData);
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);
      } finally {
        setIsLoadingPaymentData(false);
      }
    };
    
        enviarRequisicaoGet();
    }, []);

    if (isFetchingData || isLoadingPaymentData) {
    return <LoadingScreen />;
    }

    return (
    <div className="pagamentos-main">
      <HeaderPainel isPayed={data?.pagamento?.situacao !== 1 ? false : true} />
            <PaymentForm isModalOpen={isModalPayment} onClose={() => { setModalPayment(false) }} />
      
      {!isLoadingFetch && isModalError && (
                    <ModalError handleIsModalError={handleIsModalError} texto={isModalError} />
      )}
      
      {isLoadingFetch && <LoadingModal />}

      {/* Header */}
      <section className="pagamentos-header">
        <div className="header-content">
          <h1 className="header-title">MEUS PAGAMENTOS</h1>
                                            </div>
      </section>

      {/* Seção de status */}
      <section className="status-section">
        <div className="status-container glass-container">
          {data?.pagamento?.situacao !== 1 ? (
            <div className="details-container">
              <div className="details-icon">
                <ShoppingCart className="info-icon" />
                                            </div>
              <h2 className="details-text">PAGAMENTO PENDENTE</h2>
              <p className="details-subtext">Complete seu pagamento para acessar todas as funcionalidades do COEPS!</p>
                                            </div>
          ) : (
            <div className="details-container">
              <div className="details-icon">
                <CheckCircle className="info-icon" />
                                                            </div>
              <h2 className="details-text">PAGAMENTO CONFIRMADO</h2>
              <p className="details-subtext">Seu pagamento foi confirmado! Você tem acesso completo ao COEPS.</p>
                                            </div>
          )}
                                        </div>
      </section>

      {/* Seção de valores */}
      {data?.pagamento?.situacao !== 1 && dataPaymentConfig && (
        <section className="values-section">
          <div className="values-container">
            <h2 className="values-title">VALORES</h2>
            <div className="glass-container">
              <p className="intro-text">
                Abaixo você encontra informações sobre os valores correspondente ao Lote atual.
              </p>
              
              <div className="lot-badge">
                {dataPaymentConfig.nome.toLocaleUpperCase()}
                                </div>

              <div className="values-grid">
                <div className="value-card">
                  <div className="value-icon">💳</div>
                  <div className="value-type">CRÉDITO À VISTA</div>
                  <div className="value-amount">R$ {dataPaymentConfig.valorAVista.toFixed(2)}</div>
                </div>

                <div className="value-card">
                  <div className="value-icon">💴</div>
                  <div className="value-type">DÉBITO</div>
                  <div className="value-amount">R$ {dataPaymentConfig.valorAVista.toFixed(2)}</div>
                </div>

                <div className="value-card">
                  <div className="value-icon">📑</div>
                  <div className="value-type">BOLETO</div>
                  <div className="value-amount">R$ {dataPaymentConfig.valorAVista.toFixed(2)}</div>
                </div>

                <div className="value-card">
                  <div className="value-icon">🌟</div>
                  <div className="value-type">PIX</div>
                  <div className="value-amount">R$ {dataPaymentConfig.valorAVista.toFixed(2)}</div>
                </div>
            </div>

              <h3 className="installments-title">OPÇÕES DE PARCELAMENTO</h3>
              
              <div className="installments-section">
                <div className="installments-container">
                  {dataPaymentConfig?.parcelamentos?.map((value) => (
                    <div className="installment-item" key={value.codigo}>
                      <div className="installment-bullet"></div>
                      <div className="installment-text">
                        Parcelar em {value.totalParcelas} {value.totalParcelas === 1 ? "vez" : "vezes"} de R$ {value.valorCadaParcela.toFixed(2)}, 
                        totalizando R$ {(value.totalParcelas * value.valorCadaParcela).toFixed(2)}.
                </div>
            </div>
                  ))}
                </div>
                </div>
            </div>
        </div>
        </section>
      )}

      {/* Seção de botões */}
      <section className="buttons-section">
        <div className="buttons-container">
          {data?.pagamento?.situacao !== 1 && (
            <>
              <button className="action-button" onClick={handlePostClick}>
                <CreditCard size={20} />
                NOVO PAGAMENTO
                <ArrowRight size={20} />
              </button>
              
              {data?.pagamento?.lista_pagamentos && data.pagamento.lista_pagamentos.length > 0 && (
                <button className="action-button" onClick={handlePostClick2}>
                  <Receipt size={20} />
                  CONTINUAR PAGAMENTO
                  <ArrowRight size={20} />
                        </button>
                    )}
            </>
          )}
                            </div>
      </section>
                                            </div>
  );
};

// Tela de carregamento com imagem
const LoadingScreen = () => {
                                                    return (
    <div className="pagamentos-main">
      <div className="status-section">
        <div className="status-container glass-container">
          <div className="loading-container">
            <div className="loading-image"></div>
            <div className="loading-spinner">
              <Loader2 className="spinner-icon" />
            </div>
            <h2 className="loading-text">CARREGANDO PAGAMENTOS</h2>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
                            </div>
                        </div>
                    </div>
                </div>
    </div>
  );
};

// Modal de carregamento
const LoadingModal = () => {
    return (
    <div className="loading-modal">
      <div className="loading-modal-content">
        <Loader2 className="loading-modal-spinner" />
        <p className="loading-modal-text">Processando pagamento...</p>
            </div>
        </div>
    );
};

// Componente de erro (mantido do código original)
const ModalError = ({ texto, handleIsModalError }: { texto: string; handleIsModalError: (value: string | false) => void }) => {
    return (
    <div className="loading-modal">
      <div className="loading-modal-content">
        <div className="form-content">
          <div className="form-header">
            <div className="form-icon">
              <AlertCircle size={20} />
            </div>
            <h3 className="form-title">Erro</h3>
          </div>
          <p className="intro-text">{texto}</p>
                    <button
            className="form-button"
            onClick={() => handleIsModalError(false)}
                    >
            <CheckCircle size={18} style={{ marginRight: '8px' }} />
            OK
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente de formulário de pagamento (mantido do código original)
const PaymentForm = ({ isModalOpen, onClose }: { isModalOpen: boolean; onClose: () => void }) => {
  // Implementação do formulário de pagamento
  return null;
};

export default Pagamentos;