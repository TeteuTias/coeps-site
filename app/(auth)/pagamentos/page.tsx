///////
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
                      <div className="installment-text" onClick={() => {
                        console.log("asdofasjdfoaisjdf")
                      }
                      }>
                        Parcelar em {value.totalParcelas} {value.totalParcelas === 1 ? "vez" : "vezes"} de R$ {value.valorCadaParcela.toFixed(2)},
                        totalizando R$ {(value.totalParcelas * value.valorCadaParcela).toFixed(2)}.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className='w-full flex items-center content-center justify-center'>

                <button className='bg-red-500 p-5 font-extrabold text-white' onClick={() => {
                  setModalPayment(true)
                }}>
                  PAGAR PACELADO
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="buttons-section">
        <p> COLOCAR EM QUALQUER LUGAR QUE QUISER QUE: NOVO PAGAMENTO (COLOCAR AQUI OU EM OUTRO LUGAR QUE ESSE BOTÃO É SOMENTE PARA: PIX, BOLETO E CRÉDITO AVISTA; CONTINUAR PAGAMENTO: VOLTA PARA A PARTE DO PAGAMENTO PRE CRIADO DE: PIX, BOLETO OU CREDITO AVISTA</p>
        <div className="buttons-container">
          {data?.pagamento?.situacao !== 1 && (
            <>
              {
                data.pagamento.situacao === 0 ?
                  <button className="action-button" onClick={handlePostClick}>
                    <CreditCard size={20} />
                    NOVO PAGAMENTO
                    <ArrowRight size={20} />
                  </button>
                  :
                  <button className="action-button" onClick={handlePostClick2}>
                    <Receipt size={20} />
                    CONTINUAR PAGAMENTO
                    <ArrowRight size={20} />
                  </button>
              }

              {
                /* Retirei pois não entendi a parte: "data.pagamento.lista_pagamentos.length > 0"
                data?.pagamento?.lista_pagamentos && data.pagamento.lista_pagamentos.length > 0 && (
                  <button className="action-button" onClick={handlePostClick2}>
                    <Receipt size={20} />
                    CONTINUAR PAGAMENTO
                    <ArrowRight size={20} />
                  </button>
                )
                  */
              }
            </>
          )}
        </div>
      </section >

      <div className='bg-red-600'>
        <p>COLOCAR QUE O PAGAMENTO É CONFIRMADO EM ATÉ 3 DIAS</p>
        <p>COLOCAR QUE TERÁ 1 DIA ÚTIL PARA PAGAR SE CRIAR UM NOVO PAGAMENTO PARA: PIX, BOLETO E CREDITO AVISTA</p>
        <p>PODE COLOCAR EM QUALQUER LUGAR QUE ACHAR MELHOR PARA O USUÁRIO</p>
      </div>

      <section className='w-full bg-white flex flex-col items-center content-center justify-center'>
        <div>
          <p className='font-extrabold text-black'>
            Design meramente ilustrativo
          </p>
          <p className='text-black text-semibold'>
            Deve estar presente mesmo que o usuário tenha pago ou não o a inscrição
          </p>
          <p className='text-black text-semibold'>
            Pode colocar essa bomba em qualquer lugar que achar melhor
          </p>
        </div>
        <div className="text-gray-800 font-bold">
          <h1 className="text-[20px] lg:text-[20px] font-emoji">{"ℹHISTÓRICO DE PAGAMENTOS"}</h1>
          <p className="text-red-700 font-semibold">{data.pagamento.lista_pagamentos?.length ? "- " + data.pagamento.lista_pagamentos?.length.toString().padStart(2, '0') + " pagamentos encontrados" : "Você ainda não realizou nenhum pagamento."}</p>
          <div className="flex flex-col ">
            {
              data.pagamento.lista_pagamentos.length ?
                <div className="flex flex-col items-start content-start justify-start pt-10 space-y-7 w-[95%] lg:w-[65%]">
                  {
                    data.pagamento.lista_pagamentos?.map((value, index) => {
                      return (
                        <div key={index} className="">
                          <CardPagamentos eventId={data.pagamento.lista_pagamentos[index]?._eventID || ""} type={data.pagamento.lista_pagamentos[index]?._type || ""} invoiceUrl={value.invoiceUrl} valor={value.value} data_formatada={value.dateCreated} invoiceNumber={value.invoiceNumber} status={value.status} description={value.description} />
                        </div>
                      )
                    })
                  }
                </div>
                :
                ""
            }
          </div>
        </div>
      </section>
    </div >
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
  const [step, setStep] = useState(1); // 1 para informações pessoais, 2 para informações do cartão
  const [data, setData] = useState<IPaymentConfig | undefined>(undefined)
  const [messageModalWarning2, setMessageModalWarning2] = useState("")
  const [messageModalWarning, setMessageModalWarning] = useState("")
  const [textoPagamentoEscolhido, setTextoPagametoEscolhido] = useState("")
  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    postalCode: '',
    addressNumber: '',
    phone: '',
  });
  const [cardInfo, setCardInfo] = useState<{
    number: string,
    expiry: string,
    cvc: string,
    name: string,
    focus: "name" | "number" | "expiry" | "cvc" | ""
  }>({
    number: '',
    expiry: '',
    cvc: '',
    name: '',
    focus: '',
  });
  const [isConfirmationOpen, setConfirmationOpen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [idPagamento, setIdPagamento] = useState(undefined)


  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/payment/paymentConfigs', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar dados');
        }

        const data: IPaymentConfig = await response.json();
        setData(data)
        setLoading(false)
        // console.log('Dados recebidos:', data);

        // Faça algo com os dados aqui

      } catch (error) {
        setLoading(false)
        setMessageModalWarning("Erro ao buscar dados. Por favor recarregue a página e tente novamente. Caso o problema persista, entre em contato com a equipe COEPS.")
        console.error('Erro ao buscar dados:', error);
      }
    };
    fetchData();
  }, []);

  const handleIdPagamento = (id) => {
    setIdPagamento(id)
  }

  const handlePersonalInfoChange = (evt) => {
    const { name, value } = evt.target;
    setPersonalInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardInfoChange = (evt) => {
    const { name, value } = evt.target;

    if (name === 'expiry') {
      const cleanedValue = value.replace(/\D/g, '');
      let formattedValue = cleanedValue.slice(0, 4);
      if (formattedValue.length > 2) {
        formattedValue = `${formattedValue.slice(0, 2)}/${formattedValue.slice(2)}`;
      }
      setCardInfo((prev) => ({ ...prev, [name]: formattedValue }));
    } else if (name === 'cvc' && value.length > 4) {
      return;
    }
    else if (name == 'number' && value.length > 19) {
      return;
    }
    else {
      setCardInfo((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCardInfoFocus = (evt) => {
    setCardInfo((prev) => ({ ...prev, focus: evt.target.name }));
  };

  const handleSubmitPersonalInfo = (evt) => {
    evt.preventDefault();
    if (isPersonalInfoValid()) {
      setStep(2);
    }
  };

  const handleSubmitCardInfo = (evt) => {
    evt.preventDefault();
    setConfirmationOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmationOpen(false);
    setLoading(true);

    try {
      // Crie o payload com as informações pessoais e de pagamento
      const payload = {
        personalInfo,
        cardInfo,
        idPagamento,
        _id: data._id
      };

      // Envie o POST request com o JSON
      const response = await fetch('/api/payment/createCreditCardPayment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result: { message: string } = await response.json();
      if (!response.ok) {
        //console.log(result)
        throw new Error(result.message || "Aconteceu algum erro desconhecido");
      }

      setLoading(false);

      setMessageModalWarning(result.message)
      setCardInfo({
        number: '',
        expiry: '',
        cvc: '',
        name: '',
        focus: '',
      });
      // Feche o modal e faça o que for necessário após o sucesso
    } catch (error) {
      // AQUI
      setLoading(false);
      // Verificando se o erro é o CEP
      if ("Informe o endereço do titular do cartão.".includes(error.message)) {
        error.message = "Informe um CEP válido."
      }

      setMessageModalWarning2(`${error.message}`)
      // Lide com erros de forma apropriada

    } finally {

    }

  };

  const handleCancel = () => {
    setConfirmationOpen(false);
  };

  const isPersonalInfoValid = () => {
    return validateName(personalInfo.name) &&
      validateEmail(personalInfo.email) &&
      validateCpfCnpj(personalInfo.cpfCnpj) &&
      personalInfo.postalCode &&
      personalInfo.addressNumber &&
      personalInfo.phone;
  };

  const validateName = (name) => name.length > 5;

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateCpfCnpj = (cpfCnpj) => cpfCnpj.length >= 11; // Adapte conforme necessário

  const isCardInfoValid = () => {
    return cardInfo.number.length > 0 &&
      idPagamento &&
      cardInfo.expiry.length === 5 &&
      cardInfo.cvc.length > 0 &&
      cardInfo.name.length > 0;
  };

  if (!isModalOpen) return null;

  return (
    <>
      <ResponseModal message={messageModalWarning} />
      <ResponseModal2 message={messageModalWarning2} handleModalClose={() => { setMessageModalWarning2("") }} />

      <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'>
        <div className='relative bg-white p-6 rounded-lg shadow-lg w-full max-w-lg overflow-auto h-[90%]'>
          <button
            onClick={() => {
              setPersonalInfo({
                name: '',
                email: '',
                cpfCnpj: '',
                postalCode: '',
                addressNumber: '',
                phone: '',
              })
              setCardInfo({
                number: '',
                expiry: '',
                cvc: '',
                name: '',
                focus: '',
              })
              setStep(1)

              onClose()
            }}
            className='flex justify-center font-bold text-center rounded-full absolute top-2 right-2 w-7 h-7 text-white bg-red-500'
          >
            <span>x</span>
          </button>
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className='flex justify-center font-bold text-center absolute top-2 left-2 px-1 py-[0.5px] text-white bg-red-500 rounded-xl'
            >
              <span>VOLTAR</span>
            </button>
          )}
          {step === 1 && (
            <form onSubmit={handleSubmitPersonalInfo} className=''>
              <div className='text-center font-bold text-[#3e4095] text-[20px] mb-5'>
                <h1>Informações Pessoais</h1>
              </div>
              <div className='flex flex-col space-y-3'>
                <input
                  className='text-black mb-2 p-2 border rounded'
                  type="text"
                  name="name"
                  placeholder="Nome Completo"
                  value={personalInfo.name}
                  onChange={handlePersonalInfoChange}
                />
                <input
                  className='text-black mb-2 p-2 border rounded'
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={personalInfo.email}
                  onChange={handlePersonalInfoChange}
                />
                <input
                  className='text-black mb-2 p-2 border rounded'
                  type="tel"
                  name="cpfCnpj"
                  placeholder="CPF"
                  value={personalInfo.cpfCnpj}
                  onChange={handlePersonalInfoChange}
                />
                <input
                  className='text-black mb-2 p-2 border rounded'
                  type="tel"
                  name="postalCode"
                  placeholder="CEP"
                  value={personalInfo.postalCode}
                  onChange={handlePersonalInfoChange}
                />
                <input
                  className='text-black mb-2 p-2 border rounded'
                  type="tel"
                  name="addressNumber"
                  placeholder="Número da Residência"
                  value={personalInfo.addressNumber}
                  onChange={handlePersonalInfoChange}
                />
                <input
                  className='text-black mb-2 p-2 border rounded'
                  type="tel"
                  name="phone"
                  placeholder="DDD + Telefone"
                  value={personalInfo.phone}
                  onChange={handlePersonalInfoChange}
                />
                <button
                  type="submit"
                  className={`bg-blue-500 text-white py-2 px-4 rounded font-bold text-[20px] ${isPersonalInfoValid() ? '' : 'opacity-50 cursor-not-allowed'}`}
                  disabled={!isPersonalInfoValid()}
                >
                  Continuar
                </button>
              </div>
            </form>
          )}
          {step === 2 && (
            <div className=''>
              <div className='text-center font-bold text-[#3e4095] text-[20px] mb-5'>
                <h1>{data?.nome || "PAGAMENTOS"}</h1>
              </div>
              <Cards
                locale={{ valid: 'Validade', }}
                placeholders={{ name: "SEU NOME AQUI" }}
                number={cardInfo.number}
                expiry={cardInfo.expiry}
                cvc={cardInfo.cvc}
                name={cardInfo.name}
                focused={cardInfo.focus}
              />
              <form onSubmit={handleSubmitCardInfo} className='pt-3'>
                <div className='flex flex-col text-black space-y-3'>
                  <input
                    className='text-black mb-2 p-2 border rounded'
                    type="number"
                    name="number"
                    placeholder="Número do Cartão"
                    value={cardInfo.number}
                    onChange={handleCardInfoChange}
                    onFocus={handleCardInfoFocus}
                  />
                  <input
                    className='text-black mb-2 p-2 border rounded'
                    type="text"
                    name="name"
                    placeholder="Nome no Cartão"
                    value={cardInfo.name}
                    onChange={handleCardInfoChange}
                    onFocus={handleCardInfoFocus}
                  />
                  <input
                    className='text-black mb-2 p-2 border rounded'
                    type="text"
                    name="expiry"
                    placeholder="Data Vencimento"
                    value={cardInfo.expiry}
                    onChange={handleCardInfoChange}
                    onFocus={handleCardInfoFocus}
                  />
                  <input
                    className='text-black mb-2 p-2 border rounded'
                    type="number"
                    name="cvc"
                    placeholder="Número CVC"
                    value={cardInfo.cvc}
                    onChange={handleCardInfoChange}
                    onFocus={handleCardInfoFocus}
                  />
                  <div className='pt-2'>
                    <div className='text-center'>
                      <div>
                        <p className='font-bold text-[#3e4095]'>
                          OPÇÕES DE PARCELAMENTO
                        </p>
                      </div>
                      <div className='font-bold pb-8 text-[#3e4095]'>
                        <p>
                          Escolha uma das {data?.parcelamentos?.length} opções de parcelamento disponíveis:
                        </p>
                      </div>
                    </div>
                    <div className='space-y-3'>
                      {

                        data?.parcelamentos?.map((value) => {
                          return (
                            <div key={value.codigo} className={`p-5 cursor-pointer ${value.codigo == idPagamento ? 'bg-red-600' : "bg-yellow-100"}`} onClick={() => {
                              handleIdPagamento(value.codigo)
                              setTextoPagametoEscolhido(
                                `Você escolheu realizar o pagamento em ${value.totalParcelas} parcelas de R$ ${value.valorCadaParcela.toFixed(2)}, totalizando R$${(value.valorCadaParcela * value.totalParcelas).toFixed(2)}`
                              )

                            }}
                            >
                              <div>
                                <p className='text-white font-bold'>
                                  {value.codigo == idPagamento ? "SELECIONADO" : ""}
                                </p>
                              </div>
                              <h1>
                                Quero realizar o pagamento em <span className='font-bold'>{value.totalParcelas} parcelas de R${value.valorCadaParcela.toFixed(2)}</span>, totalizando <span className='font-bold'>R${(value.valorCadaParcela * value.totalParcelas).toFixed(2)}</span>.
                              </h1>
                            </div>
                          )
                        })
                      }
                    </div>
                  </div>
                  <button
                    type="submit"
                    className={`bg-red-600 text-white py-2 px-4 rounded font-bold text-[20px] ${isCardInfoValid() ? '' : 'opacity-50 cursor-not-allowed'}`}
                    disabled={!isCardInfoValid()}
                  >
                    PAGAR
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação */}
      {isConfirmationOpen && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-2'>
          <div className='bg-white p-6 rounded-lg shadow-lg w-full max-w-lg'>
            <h2 className='text-center font-bold text-[#3e4095] text-[20px] mb-5'>Confirmar Pagamento</h2>
            <p className='text-black'>{textoPagamentoEscolhido}.</p>
            <div className='flex justify-center space-x-4'>
              <button
                onClick={handleConfirm}
                className='bg-blue-500 text-white py-2 px-4 rounded font-bold'
              >
                Sim
              </button>
              <button
                onClick={handleCancel}
                className='bg-red-500 text-white py-2 px-4 rounded font-bold'
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'>
          <div className='bg-white p-6 rounded-lg shadow-lg w-full max-w-lg'>
            <h2 className='text-center font-bold text-[#3e4095] text-[20px] mb-5'>Processando...</h2>
            <div className='flex justify-center'>
              <div className='spinner-border animate-spin' role='status'>
                <span className='sr-only'>Loading...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ResponseModal = ({ message }: { message: string }) => {
  if (!message) {
    return;
  }
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[100]'>
      <div className='bg-white p-6 rounded-lg shadow-lg w-full max-w-lg'>
        <p className='text-center mb-5 text-black'>{message}</p>
        <div className='flex justify-center space-x-4'>
          <button
            onClick={() => { window.location.reload(); }}
            className='bg-gray-500 text-white py-2 px-4 rounded font-bold'
          >
            Recarregar Página
          </button>
        </div>
      </div>
    </div>
  );
};

const ResponseModal2 = ({ handleModalClose, message }: { handleModalClose, message: string }) => {
  if (!message) {
    return;
  }
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[100]'>
      <div className='bg-white p-6 rounded-lg shadow-lg w-full max-w-lg'>
        <p className='text-center mb-5 text-black'>{message}</p>
        <div className='flex justify-center space-x-4'>
          <button
            onClick={handleModalClose}
            className='bg-gray-500 text-white py-2 px-4 rounded font-bold'
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const CardPagamentos = ({ eventId, type, data_formatada, invoiceNumber, status, description, valor, invoiceUrl }: {
  eventId: string, type: string, data_formatada: any, invoiceNumber: string, status: string, description: string, valor: number, invoiceUrl: string
}) => {
  // Arrumando a DATA
  //
  //
  const [typeText, setTypeText] = useState<ILecture["name"]>("CARREGANDO ATIVIDADE")

  useEffect(() => {
    // Defina a função assíncrona dentro do `useEffect`
    async function fetchData() {
      try {
        if (type == "activity" && typeText == "CARREGANDO ATIVIDADE") {
          // Execute operações assíncronas aqui
          const response = await fetch(`/api/get/atividadeNomePeloId/${eventId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            setTypeText("ERRO AO CARREGAR NOME")
            return;
          }
          const responseJson: { data: ILecture["name"] } = await response.json()
          // Faça algo com a resposta, como atualizar o estado
          setTypeText(responseJson.data)
        }
      } catch (error) {
        setTypeText("ERRO AO CARREGAR NOME")
        console.error('Erro ao buscar dados:', error);
      }
    }

    // Chame a função assíncrona
    fetchData();
  }, [typeText, eventId, type]);
  //
  /*
      Dicionário
      ACTIVE => Aguardando
  
  */
  switch (true) { // "Traduz o que está escrito no status."
    case status == "PAYMENT_CONFIRMED" || status == "CONFIRMED" || status == "PAYMENT_RECEIVED":
      status = "PAGO"
      break
    case status == "PAYMENT_OVERDUE":
      status = "CANCELADO"
      break
    case status == "PENDING":
      status = "PAGAMENTO PENDENTE"
      break

    case status == "PAYMENT_REFUNDED":
      status = "COBRANÇA ESTORNADA"
      break
    case status == "PAYMENT_REFUND_DENIED":
      status = "ESTORNO NEGADO"
      break
    case status == "PAYMENT_PARTIALLY_REFUNDED":
      status = "PARCIALMENTE ESTORNADO"
      break
    case status == "PAYMENT_REFUND_IN_PROGRESS":
      status = "PROCESSANDO ESTORNO"
      break
  }

  return (
    <div className="shadow-[0px_0px_5px_7px_rgba(0,0,0,0.02)] p-4 rounded-xl cursor-pointer relative">
      {
        type == "activity" ?
          <p onClick={() => console.log(typeText)}>{typeText}</p>
          : ""
      }
      <div className="flex flex-row justify-center items-center content-center align-middle absolute z-10 p-1 bg-[#ff8952] top-[-15px] left-[-6px] space-x-[3px] rounded-sm">
        <div className="text-[white] flex flex-row space-x-[3px]">
          <h1 className="font-bold text-[13px]">R$</h1>
          <p className="font-serif text-[13px]">{valor}</p>
        </div>
      </div>
      <div className="flex flex-row space-x-8">
        <div className="flex w-[20%]">
          <p className="text-red-600 font-mono text-[13px] lg:text-[13px]">{data_formatada}</p>
        </div>
        <div className="flex">
          <p className="text-red-600 font-mono text-[13px] lg:text-[13px]">{description}</p>
        </div>
      </div>
      <div className="flex flex-row justify-start items-center content-center">
        <div className="flex-1 w-[80%]">
          <p>#{invoiceNumber}</p>
        </div>
        <div className="flex flex-row">
          <h1>{status}</h1>
        </div>
      </div>
      {
        status != "PAYMENT_OVERDUE" ?
          <Link target="_blank" prefetch={false} href={invoiceUrl} className="">
            <p className="text-[13px] font-thin">Clique aqui para acessar</p>
          </Link> : ""
      }
    </div>
  )
}


export default Pagamentos;

