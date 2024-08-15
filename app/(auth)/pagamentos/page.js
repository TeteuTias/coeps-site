'use client'
import 'react-credit-cards-2/dist/es/styles-compiled.css';
import { useUser } from "@auth0/nextjs-auth0/client"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation';
import Link from "next/link";
import Image from "next/image";
import TelaLoading from "@/app/components/TelaLoading";
import PaginaErrorPadrao from "@/app/components/PaginaErrorPadrao";
import HeaderPainel from "@/app/components/HeaderPainel";
import Cards from 'react-credit-cards-2';
import WarningModal from '@/app/components/WarningModal';
//
//
//
//
export default function Pagamentos() {
    const { user, isLoading } = useUser();
    const route = useRouter()
    const [isLoadingFetch, setIsLoadingFetch] = useState(0)
    const [isModalError, setIsModalError] = useState(0) // Pode ser 0 ou alguma string, que sinaliza um erro.
    const [data, setData] = useState(undefined)
    const [isFetchingData, setIsFetchingData] = useState(1) // Já começa 01 porque para não renderizar o outro e depois voltar.
    const [isModalPayment, setModalPayment] = useState(0)
    //
    //
    //
    const handleData = (event) => {
        setData(event)
    }
    //
    const handleIsFetchingData = (event) => {
        setIsFetchingData(event)
    }
    //
    const handleIsModalError = (event) => {
        // Considere event igual ao boleado ou texto que voce quer colocar.
        setIsModalError(event)
    }
    //
    const handleIsLoadingFetch = (event) => {
        // Considere event igual ao boleado que voce quer colocar.
        setIsLoadingFetch(event)
    }
    const handlePostClick = async () => {
        // Ativar isLoadingFetch
        handleIsLoadingFetch(1)
        try {
            // Exemplo de dados a serem enviados no corpo da requisição POST
            const data = {
                title: 'Título do Post',
                body: 'Conteúdo do Post',
                userId: 1,
            };

            // Configuração da requisição POST usando fetch
            const response = await fetch('/api/payment/create_payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            // Verifica se a requisição foi bem-sucedida
            if (!response.ok) {
                try {
                    const erro_message = await response.json()
                    console.log("erro_message")
                    throw new Error('Falha ao enviar a requisição POST');


                }
                catch {
                    console.log("!response.ok - catch")
                    throw new Error('Falha ao enviar a requisição POST');
                }
            }

            // Converte a resposta para JSON
            const responseData = await response.json(); // {link:url_para_o_pagamento}

            // Exibe a resposta no console para fins de demonstração
            //console.log('Resposta da requisição POST:', responseData);

            route.push(responseData.link)

            // Atualiza o estado com os dados da resposta, se necessário
        } catch (error) {
            console.error('Erro ao enviar a requisição POST:', error);
            handleIsLoadingFetch(0)
            handleIsModalError("Ocorreu algum erro. Tente novamente mais tarde. ")
            // Tratar erros conforme necessário
        }
        finally {
            // nao coloquei o handleIsLoadingFetch(0) porque quando dá certo de criar o pagamento, quero que ele seja redirecionado direto, sem chances de dar setstate.

        }
    };
    const handlePostClick2 = async () => {
        // Ativar isLoadingFetch
        handleIsLoadingFetch(1)
        try {
            if (!data || !data.pagamento.lista_pagamentos || data?.pagamento?.lista_pagamentos?.length == 0) {
                console.log("ERROR: !Data || !data.lista_pagamentos")
                // Configurar o erro aqui...
            }
            const statusFiltro = ["PENDING"]
            const filtroLinks = data.pagamento.lista_pagamentos.filter(item => statusFiltro.includes(item.status)).map(item => item.invoiceUrl)[0] // [0] pq tecnicamente, deve haver só um, se tudo estiver nos conformes.
            handleIsLoadingFetch(0)
            route.push(filtroLinks)


        }
        catch (error) {
            console.log("ERROR: CATCH HANDLEPOSTCLICK2")
            console.log(error)
            handleIsLoadingFetch(0)
        }
        //
    };
    //
    const url_get_usuariosPagamentos = "/api/get/usuariosPagamentos"
    //
    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                // Configuração da requisição GET usando fetch
                const response = await fetch(url_get_usuariosPagamentos, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                // Verifica se a requisição foi bem-sucedida
                if (!response.ok) {
                    console.log(response)
                    throw new Error('Falha ao enviar a requisição GET');
                }

                // Converte a resposta para JSON
                const responseData = await response.json();

                // Exibe a resposta no console para fins de demonstração
                console.log('Resposta da requisição GET:', responseData);

                handleIsFetchingData(0)
                handleData(responseData.data)
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);

                // Tratar erros conforme necessário
            }
        };
        if (!isLoading) {
            enviarRequisicaoGet();
        }
    }, [isLoading, user]);
    //
    if (isFetchingData) {
        return <TelaLoading />
    }
    //
    return (
        <>
            <HeaderPainel isPayed={data?.pagamento?.situacao != 1 ? 0 : 1} />
            <PaymentForm isModalOpen={isModalPayment} onClose={() => { setModalPayment(0) }} />
            {
                !isLoadingFetch && isModalError ?
                    <ModalError handleIsModalError={handleIsModalError} texto={isModalError} />
                    :
                    ""
            }
            {
                isLoadingFetch ?
                    <div className="flex items-center content-center justify-center w-full min-h-screen absolute z-50 ">
                        <h1 className=" font-extralight text-black lg:text-[40px] animate-pulse">C A R R E G A N D O</h1>
                    </div>
                    : ""
            }
            <div className={`flex flex-col content-center items-center align-middle min-h-screen ${isLoadingFetch || isModalError ? "blur" : ""}`}>
                <div className="bg-[#3E4095] w-full p-5 lg:p-16">
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Meus Pagamentos</h1>
                </div>
                <div className="  w-full ">
                    <div className="flex content-center items-center justify-center py-16  bg-white">
                        <div className=" p-4 space-y-6 w-full md:w-[60%]">
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
                                                                <CardPagamentos invoiceUrl={value.invoiceUrl} valor={value.value} nome={'nome'} data_formatada={value.dateCreated} invoiceNumber={value.invoiceNumber} status={value.status} description={value.description} />
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
                        </div>
                    </div>
                    <div className="flex flex-col content-center items-center justify-center py-16 bg-[#3E4095]">
                        <div className="w-[100%] p-4 text-black space-y-2 md:w-[60%]">
                            <h1 className="text-[20px] lg:text-[20px] text-slate-100 font-bold font-emoji">{"ℹSITUAÇÃO DE INSCRIÇÃO"}</h1>
                            <div className="">
                                {!data.pagamento.situacao || data.pagamento.situacao == 2 ?
                                    <p className="text-white">
                                        Realize seu primerio pagamento para confirmar sua inscrição.Para pagar, escolha entre criar pagamento à vista (CRÉDITO À VISTA, PIX ou BOLETO) ou parcelamento no cartão de crédito.
                                        A confirmação de seu pagamento é realizada de forma <span className="font-bold bg-yellow-400 px-1">automática</span> em até <span className="font-bold bg-yellow-400 px-1">03 dias</span>.
                                    </p>
                                    :
                                    <p className="text-white">
                                        Sua inscrição foi <span className="font-bold bg-yellow-400 px-1">confirmada</span>.<span className=""> Aproveite o evento</span>!
                                    </p>
                                }
                            </div>
                            <div>
                                {data.pagamento.situacao == 0 ?
                                    <div className="flex flex-col justify-start lg:justify-start space-y-3 md:space-y-3">
                                        <button onClick={() => { handlePostClick() }} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError ? "cursor-not-allowed" : ""}`} disabled={isLoadingFetch || isModalError ? true : false}>
                                            REALIZAR INSCRIÇÃO
                                            <p className='text-[10px]'>
                                                (PIX, CRÉDITO À VISTA, BOLETO)
                                            </p>
                                        </button>
                                        <button onClick={() => { setModalPayment(1) }} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError ? "cursor-not-allowed" : ""}`} disabled={isLoadingFetch || isModalError ? true : false}>
                                            REALIZAR INSCRIÇÃO
                                            <p className='text-[10px]'>
                                                (CRÉDITO PARCELADO)
                                            </p>
                                        </button>
                                        <p className='text-white'>
                                            Após escolher uma opção de pagamento, você terá <span className="font-bold bg-yellow-400 px-1">1 dia útil</span> para realizar o pagamento
                                        </p>
                                    </div>
                                    : ""
                                }
                                {data.pagamento.situacao == 2 ?
                                    <div className="flex justify-center lg:justify-start">
                                        <button onClick={() => { handlePostClick2() }} className={`bg-[#eb7038] text-white font-extrabold p-4 ${isLoadingFetch || isModalError ? "cursor-not-allowed" : ""}`} disabled={isLoadingFetch || isModalError ? true : false}>REALIZAR INSCRIÇÃO</button>
                                    </div>
                                    : ""
                                }
                            </div>
                        </div>
                    </div>
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" fill="#3e4095" >
                            <path className="" d="M761.9,44.1L643.1,27.2L333.8,98L0,3.8V0l1000,0v3.9"></path>
                        </svg>
                    </div>
                    <div className="flex flex-col content-center items-center justify-center py-16 bg-white">
                        <div className="md:w-[60%] p-4 text-black space-y-2">
                            <h1 className="text-[20px] lg:text-[20px] text-gray-800 font-bold font-emoji">{"ℹCONTATO"}</h1>
                            <h1>Em caso de dúvidas ou se o pagamento não for confirmado em até 03 dias, entre em contato com nossa equipe.</h1>
                            <div className="flex flex-col lg:flex-row items-center content-center justify-center text-center space-x-2">
                                <div className=" flex-1 flex-col  ">
                                    <h1 className="font-bold px-2">Telefone</h1>
                                    <h1>(00) 0000-0000</h1>
                                </div>
                                <div className="flex-1 flex-col ">
                                    <h1 className="font-bold px-2">Email</h1>
                                    <h1>vcoeps.dadg@gmail.com</h1>
                                </div>
                                <div className="flex-1 flex-col ">
                                    <h1 className="font-bold px-2">Instagram</h1>
                                    <Link href='https://www.instagram.com/coeps.araguari/' prefetch={false} target="_blank" >coeps.araguari</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

const CardPagamentos = ({ valor_total = "ERROR", data_formatada = "ERROR", invoiceNumber = "ERROR", status = "ERROR", description = "ERROR", valor = "ERROR", invoiceUrl = "/pagamentos" }) => {
    // Arrumando a DATA
    //
    //
    //
    /*
        Dicionário
        ACTIVE => Aguardando
    
    */
    switch (true) { // "Traduz o que está escrito no status."
        case status == "PAYMENT_CONFIRMED" || status == "CONFIRMED":
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
            <div className="flex flex-row justify-center items-center content-center align-middle absolute z-10 p-1 bg-[#ff8952] top-[-15px] left-[-6px] space-x-[3px] rounded-sm">
                {
                    valor == "ERROR" ?
                        <h1 className="font-bold text-[13px]">{valor}</h1>
                        :
                        <div className="text-[white] flex flex-row space-x-[3px]">
                            <h1 className="font-bold text-[13px]">R$</h1>
                            <p className="font-serif text-[13px]">{valor}</p>
                        </div>
                }
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

function ModalError({ texto, handleIsModalError }) {
    return (
        <div className="flex items-center content-center justify-center w-full min-h-screen absolute z-50">
            <div className="flex flex-col items-center content-center justify-center bg-white p-5 w-[90%] lg:w-[40%]">
                <h1 className="text-black text-center font-extrabold lg:text-[25px]">ERRO</h1>
                <div className="">
                    <h1 className=" font-extralight text-black lg:text-[35px]">{texto}</h1>
                </div>
                <div className="bg-[#3E4095] text-white font-bold p-3">
                    <button onClick={() => { handleIsModalError(0) }} >FECHAR</button>
                </div>
            </div>
        </div>
    )
}

const PaymentForm = ({ isModalOpen, onClose }) => {
    const [step, setStep] = useState(1); // 1 para informações pessoais, 2 para informações do cartão
    const [data, setData] = useState(undefined)
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
    const [cardInfo, setCardInfo] = useState({
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

                const data = await response.json();
                setData(data)
                setLoading(false)
                console.log('Dados recebidos:', data);

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
        } else {
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
            const result = await response.json();
            if (!response.ok) {
                //console.log(result)
                throw new Error(result.message || "Aconteceu algum erro desconhecido");
            }

            setLoading(false);

            setMessageModalWarning(result.message)
            setData({
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
                        onClick={onClose}
                        className='flex justify-center font-bold text-center rounded-full absolute top-2 right-2 w-7 h-7 text-white bg-red-500'
                    >
                        <span>x</span>
                    </button>
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className='flex justify-center font-bold text-center absolute top-2 left-2 px-1 text-white bg-red-500'
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
                                    type="text"
                                    name="cpfCnpj"
                                    placeholder="CPF"
                                    value={personalInfo.cpfCnpj}
                                    onChange={handlePersonalInfoChange}
                                />
                                <input
                                    className='text-black mb-2 p-2 border rounded'
                                    type="text"
                                    name="postalCode"
                                    placeholder="CEP"
                                    value={personalInfo.postalCode}
                                    onChange={handlePersonalInfoChange}
                                />
                                <input
                                    className='text-black mb-2 p-2 border rounded'
                                    type="text"
                                    name="addressNumber"
                                    placeholder="Número do Endereço"
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
                                <h1 onClick={() => { console.log(data) }}>{data?.nome || "PAGAMENTOS"}</h1>
                            </div>
                            <Cards
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
                                                                `Você escolheu realizar o pagamento em ${value.totalParcelas} parcelas de R$ ${value.valorCadaParcela}, totalizando R$${value.valorCadaParcela * value.totalParcelas}`
                                                            )

                                                        }}
                                                        >
                                                            <div>
                                                                <p className='text-white font-bold'>
                                                                    {value.codigo == idPagamento ? "SELECIONADO" : ""}
                                                                </p>
                                                            </div>
                                                            <h1>
                                                                Quero realizar o pagamento em <span className='font-bold'>{value.totalParcelas} parcelas de R${value.valorCadaParcela}</span>, totalizando <span className='font-bold'>R${value.valorCadaParcela * value.totalParcelas}</span>.
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
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'>
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

const ResponseModal = ({ handleModalClose, handleModalAction, message = "" }) => {
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

const ResponseModal2 = ({ handleModalClose, handleModalAction, message = "" }) => {
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