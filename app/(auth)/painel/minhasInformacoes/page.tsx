'use client'
import { useEffect, useState } from "react"
import WarningModal from "@/components/WarningModal"
import Link from "next/link"
import { IUser } from "@/app/lib/types/user/user.t"
//
//
//
export default function MinhasInformacoes() {
    const [loading, setLoading] = useState<boolean>(true)
    const [loadingModal, setLoadingModal] = useState<boolean>(false)
    const [DATA, setData] = useState<IUser["informacoes_usuario"] | undefined>(undefined)
    const [message, setMessage] = useState<string | undefined>(undefined)
    const [isModal, setIsModal] = useState<boolean>(false)
    //
    //
    useEffect(() => {
        const enviarRequisicaoGet = async () => {
            try {
                // Configuração da requisição GET usando fetch
                const response = await fetch('/api/get/usuariosConfig', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                // Verifica se a requisição foi bem-sucedida
                if (!response.ok) {
                    throw new Error('Falha ao enviar a requisição GET');
                }
                // Converte a resposta para JSON
                const responseData: IUser["informacoes_usuario"] = await response.json();
                setData(responseData)
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);
            }
            finally {
                setLoading(false)
            }
        };
        enviarRequisicaoGet();

    }, []);
    //
    const closeModalMessage = (e) => {
        setIsModal(e)
    }
    // 
    const updateData = async (update: { [key: string]: string }) => {
        // update = {campo_a_ser_atualizado: atualizacao}
        if (Object.values(update)[0].trim() == "") {
            setMessage("Preencha o campo antes de realizar a atualização.")
            setIsModal(true)
            return undefined
        }
        console.log(DATA)
        try {
            setLoadingModal(true)
            // console.log(update)
            const response = await fetch('/api/put/usuarioConfig', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(update),
            });
            const responseJson = await response.json()
            if (!response.ok) {
                setMessage(responseJson.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro continue, entre em contato com a equipe COEPS.")
                setIsModal(true)
                return undefined
            }
            setMessage(responseJson.message)
            setIsModal(true)
            setData(prev => ({
                ...prev,
                ...update

            }))


        }
        catch (erro) {
            console.log(erro)
        }
        finally {
            setLoadingModal(false)
        }
    }
    //
    return (
        <>
            <WarningModal message={message} isModal={isModal} closeModal={closeModalMessage} textButton={""} onClose={function (): void {
                throw new Error("Function not implemented.")
            }} />
            <LoadingModal isLoading={loadingModal} />
            <div className=" bg-zinc-50" onClick={() => { console.log(DATA) }}>
                <div className='bg-[#3E4095] p-5'>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Configurações de Usuário</h1>
                </div>
                <div className="flex flex-col items-center space-y-5 py-4">
                    <Card label={"Nome"} placeholder={DATA?.nome ?? ""} labelButton={"Trocar Nome"} loading={loading} onClick={updateData} nomeCampo={'nome'} type={"text"} />
                    <CardAlterarSenha label="Alterar Senha" labelButton="Trocar Senha" loading={loading} />
                    { /*<Card label={"Email"} placeholder={DATA?.email ?? ""} labelButton={"Trocar Email"} loading={loading} onClick={updateData} nomeCampo={'email'} /> */}
                    <Card label={"Cpf"} placeholder={DATA?.cpf ?? ""} labelButton={"Trocar Cpf"} loading={loading} type={"number"} onClick={updateData} nomeCampo={'cpf'} />
                    <Card label={"Telefone Whatsapp"} placeholder={DATA?.numero_telefone ?? ""} labelButton={"Trocar Telefone"} loading={loading} type={"number"} onClick={updateData} nomeCampo={'numero_telefone'} />
                </div>
            </div>
        </>
    )
}
//
const LoadingModal = ({ isLoading = true }) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-[200]">
            <div className="flex flex-row content-center items-center justify-center p-5 rounded shadow-lg text-center bg-white">

                <svg className="flex flex-row content-center items-center justify-center animate-spin h-10 w-10 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z" />
                </svg>

                <p className="text-lg font-semibold p-4 text-black">Carregando</p>
            </div>
        </div>
    );
};
//
const Card = ({ label = "NÃO DEFINIDO", placeholder = "NÃO DEFINIDO", labelButton = "NÃO DEFINIDO", loading = true, type = 'text', onClick, nomeCampo }: {
    // E esta é a parte da ANOTAÇÃO DE TIPO para o objeto de props
    label: string;
    placeholder: string;
    labelButton: string;
    loading: boolean;
    type: 'text' | 'password' | 'email' | 'number' | 'date';
    onClick: ({ }) => Promise<void>;
    nomeCampo: string;
}) => {
    const [inputValue, setInputValue] = useState('');

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };

    if (loading) {
        return (
            <div className="border-[1px] border-teal-300 rounded-t-lg w-[95%] lg:w-[30%] pb-5 rounded-b-lg bg-white">
                <div className={`text-[1rem] font-semibold text-black p-4 border-b-[1px] animate-pulse`}>
                    <h1>CARREGANDO</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="border-[1px] border-teal-300 rounded-t-lg w-[95%] lg:w-[30%] pb-5 rounded-b-lg bg-white">
            <div className={`text-[1rem] font-semibold text-black p-4 border-b-[1px]`}>
                <h1>{label}</h1>
            </div>
            <div className="p-4">
                <div className="w-[100%]">
                    <input
                        type={type}
                        placeholder={placeholder}
                        className="border-[1px] p-2 rounded-lg w-[100%] text-gray-600"
                        value={inputValue}
                        onChange={handleInputChange}
                    />
                </div>
            </div>
            <div className="text-[1rem] font-thin text-black px-4">
                <button className="border-[1px] px-2 py-1 rounded-lg hover:bg-slate-100 hover:border-slate-600" onClick={() => {
                    onClick({ [nomeCampo]: inputValue })
                    setInputValue("")
                }}
                >
                    {labelButton}
                </button>
            </div>
        </div>
    );
};
const CardAlterarSenha = ({ label = "NÃO DEFINIDO", labelButton = "NÃO DEFINIDO", loading = true }: { label: string, labelButton: string, loading: boolean }) => {
    const [modal, setModal] = useState<string>("")
    if (loading) {
        return (
            <div className="border-[1px] border-teal-300 rounded-t-lg w-[95%] lg:w-[30%] pb-3 rounded-b-lg bg-white">
                <div className="text-[1rem] font-semibold text-black p-4 border-b-[1px] animate-pulse">
                    <h1>CARREGANDO</h1>
                </div>
            </div>
        )
    }
    const WarningModal = ({ message = "MENSAGEM NÃO DEFINIDA", textButton = "FECHAR", onClose = () => { }, closeModal = () => { }, isModal = true }
        : { message: string, textButton: string, onClose: () => void, closeModal: () => void, isModal: boolean }
    ) => {
        return (
            <>
                {
                    isModal ?
                        <div className=" fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                            < div className="w-[85%] sm:w-full bg-white p-6 rounded-lg shadow-lg max-w-md " >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-yellow-500 text-2xl mr-2">⚠️</span>
                                        <h2 className="text-xl font-semibold text-gray-800">Aviso</h2>
                                    </div>

                                </div>
                                <p className="mt-4 text-gray-600">{message}</p>
                                <div className="flex flex-row justify-end space-x-2 mt-6 text-right">
                                    <Link href="/api/auth/logout">
                                        <button
                                            className="bg-red-600 font-bold text-white py-2 px-4 rounded hover:bg-red-400 transition"
                                            onClick={
                                                () => {
                                                    closeModal()
                                                    onClose()
                                                }
                                            }
                                        >
                                            CONTINUAR
                                        </button>
                                    </Link>
                                    <button
                                        className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-400 transition"
                                        onClick={
                                            () => {
                                                closeModal()
                                                onClose()
                                            }
                                        }
                                    >
                                        {textButton}
                                    </button>
                                </div>
                            </div >
                        </div >
                        : ""
                }
            </>
        );
    };
    return (
        <>
            <WarningModal isModal={modal.length == 0 ? false : true} closeModal={() => { setModal("") }} message={modal} textButton={"Obrigado(a)"} onClose={function (): void {
                throw new Error("Function not implemented.")
            }} />
            <div className="border-[1px] border-teal-300 rounded-t-lg w-[95%] lg:w-[30%] pb-3 rounded-b-lg bg-white">
                <div className="text-[1rem] font-semibold text-black p-4 border-b-[1px]">
                    <h1>{label}</h1>
                </div>
                <div className="p-4 ">
                    <div className="w-[100%] text-black ">
                        <button className="border-[1px] px-2 py-1 rounded-lg font-extralight hover:bg-slate-100 hover:border-slate-600" onClick={() => { setModal("Para alterar a sua senha, você será para a tela de login onde encontrará a opção 'Esqueci minha senha'. Ao clicar nessa opção, você receberá as instruções necessárias para prosseguir. Se desejar continuar após isso, clique em 'Continuar'.") }}>{labelButton}</button>
                    </div>
                </div>
            </div>
        </>
    )
}