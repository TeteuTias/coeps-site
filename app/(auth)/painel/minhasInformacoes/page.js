'use client'
import { useEffect, useState } from "react"
import WarningModal from "@/app/components/WarningModal"
//
//
//
export const MinhasInformacoes = () => {
    const [loading, setLoading] = useState(1)
    const [loadingModal, setLoadingModal] = useState(0)
    const [DATA, setData] = useState(undefined)
    const [message, setMessage] = useState(undefined)
    const [isModal, setIsModal] = useState(0)
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
                const responseData = await response.json();
                console.log(responseData)
                setData(responseData)
            } catch (error) {
                console.error('Erro ao enviar a requisição GET:', error);
            }
            finally {
                setLoading(0)
            }
        };
        enviarRequisicaoGet();

    }, []);
    //
   const closeModalMessage = (e) => { 
    setIsModal(e)
   }
    // 
    const updateData = async (update) => {
        // update = {campo_a_ser_atualizado: atualizacao}
        console.log(DATA)
        try {
            setLoadingModal(1)
            // console.log(update)
            const response = await fetch('/api/put/usuarioConfig', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(update),
            });
            const responseJson = await response.json()
            if (response.ok) {
                setMessage(responseJson.message)
                setIsModal(1)
                setData( prev => ({
                    ...prev,
                    ...update

                }))
            }
        }
        catch (erro) {
            console.log(erro)
        }
        finally {
            setLoadingModal(0)
        }
    }
    //
    return (
        <>
            <WarningModal message={message} isModal={isModal} closeModal={closeModalMessage}/>
            <LoadingModal isLoading={loadingModal} />
            <div className=" bg-zinc-50" onClick={()=>{console.log(DATA)}}>
                <div className='bg-[#3E4095] p-5'>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Configurações de Usuário</h1>
                    <h1 className="text-center">{'# LEMBRETE PESSOAL - [ CONFIGURAR TROCAR SENHA ] #'}</h1>
                </div>
                <div className="flex flex-col items-center space-y-5 py-4">
                    <Card label={"Nome"} placeholder={DATA?.nome ?? ""} labelButton={"Trocar Nome"} loading={loading} onClick={updateData} nomeCampo={'nome'} />
                    <CardAlterarSenha label="Alterar Senha" labelButton="Trocar Senha" loading={loading} />
                    <Card label={"Email"} placeholder={DATA?.email ?? ""} labelButton={"Trocar Email"} loading={loading} onClick={updateData} nomeCampo={'email'} />
                    <Card label={"Cpf"} placeholder={DATA?.cpf ?? ""} labelButton={"Trocar Cpf"} loading={loading} type={"number"} onClick={updateData} nomeCampo={'cpf'} />
                    <Card label={"Telefone"} placeholder={DATA?.numero_telefone ?? ""} labelButton={"Trocar Telefone"} loading={loading} type={"number"} onClick={updateData} nomeCampo={'numero_telefone'} />
                </div>
            </div>
        </>
    )
}
export default MinhasInformacoes
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
const Card = ({ label = "NÃO DEFINIDO", placeholder = "NÃO DEFINIDO", labelButton = "NÃO DEFINIDO", loading = true, type = 'text', onClick = () => { }, nomeCampo }) => {
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
                    onClick({[nomeCampo]:inputValue})
                    setInputValue("")
                }}
                    >
                    {labelButton}
                </button>
            </div>
        </div>
    );
};
const CardAlterarSenha = ({ label = "NÃO DEFINIDO", labelButton = "NÃO DEFINIDO", loading = true, onClick = () => { } }) => {
    if (loading) {
        return (
            <div className="border-[1px] border-teal-300 rounded-t-lg w-[95%] lg:w-[30%] pb-3 rounded-b-lg bg-white">
                <div className="text-[1rem] font-semibold text-black p-4 border-b-[1px] animate-pulse">
                    <h1>CARREGANDO</h1>
                </div>
            </div>
        )
    }
    return (
        <div className="border-[1px] border-teal-300 rounded-t-lg w-[95%] lg:w-[30%] pb-3 rounded-b-lg bg-white">
            <div className="text-[1rem] font-semibold text-black p-4 border-b-[1px]">
                <h1>{label}</h1>
            </div>
            <div className="p-4 ">
                <div className="w-[100%] text-black ">
                    <button className="border-[1px] px-2 py-1 rounded-lg font-extralight hover:bg-slate-100 hover:border-slate-600" onClick={() => { onClick() }}>{labelButton}</button>
                </div>
            </div>
        </div>
    )
}