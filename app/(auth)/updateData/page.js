'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { useState, useEffect } from "react";
import TelaLoading from "@/app/components/TelaLoading";
//
//
//
export default function UpdateData() {
    const { user, error, isLoading } = useUser();
    const router = useRouter()
    //
    //
    const [value_name, setValueName] = useState('');
    const [value_telefone, setValueTelefone] = useState('');
    const [value_cpf, setValueCpf] = useState('');
    const [avisoErro, setAvisoErro] = useState('')
    //
    const [isLoadingForms, setIsLoadingForms] = useState(0)

    const handleChangeAvisoErro = (event) => {
        setAvisoErro(event)
    }
    const handleChangeSetIsLoadingForms = (bool) => {
        setIsLoadingForms(bool);
    };
    const handleChangeName = (event) => {
        setValueName(event.target.value);
    };
    const handleChangeTelefone = (event) => {
        setValueTelefone(event.target.value);
    };
    const handleChangeCpf = (event) => {
        setValueCpf(event.target.value);
    };
    //
    //
    //

    if (isLoading) {
        return <TelaLoading />
    }

    if (!user) {
        router.push('/')
        return <></>
    }
    const fetchData = async () => {
        if (isLoadingForms) {
            return 0
        }
        try {
            // ANTES DE ENVIAR. FAZE ALGUMAS VERIFICAÇÕES PARA VER SE TODOS OS CAMPOS FORAM PREENCHIDOS.
            // Fiz um switch para cada um para ficar mais controlado. Coloquei true pq ele sempre vai passar
            // Nao houve necessidade do default
            handleChangeSetIsLoadingForms(1)
            switch (true) { // NAME
                case (value_name.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Nome Completo"`)
                    return 0

                case (value_name.trim().length <= 4):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Nome Completo" com mais de 4 caracteres`)
                    return 0
            }
            switch (true) { // Número de Telefone
                case (!/^\d+$/.test(value_telefone.trim())):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Número de telefone" com apenas números`)
                    return 0
                case (value_telefone.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Número de telefone"`)
                    return 0
                case (value_telefone.trim().length <= 4):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Número de telefone" com mais de 4 caracteres`)
                    return 0
            }
            switch (true) { // Cpf
                case (!/^\d+$/.test(value_cpf.trim())):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Cpf" com apenas números`)
                    return 0
                case (value_cpf.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Cpf"`)
                    return 0
                case (value_cpf.trim().length <= 4):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Cpf" com mais de 4 caracteres`)
                    return 0
            }
            //
            //
            // Agora que ele sobrevivel aos switch's, ele pode fazer o fetch.
            const response = await fetch('/api/post/updateData',
                {
                    method: 'POST', // Método da requisição
                    headers: {
                        'Content-Type': 'application/json' // Tipo de conteúdo do corpo da requisição
                    },
                    body: JSON.stringify({
                        "nome": value_name,
                        "numero_telefone": value_telefone,
                        "cpf": value_cpf
                    }) // Corpo da requisição (dados a serem enviados)
                })

            if (!response.ok) {
                throw new Error('Erro ao carregar os dados');
            }
            const data = await response.json();
            if (!data['sucesso']) {
                console.log(data)
                throw new Error(data);
            }
            //console.log(data)
            router.push('/painel/pagamentos')// se der tudo certo, ele vai direto pro /painel
        } catch (error) {
            console.error('Erro na requisição:', error);
        }
        finally {

        }
    };
    //
    //<h1 className="text-black">{user?"Voce está logado":"Voce não está logado"}</h1>

    return (
        <div className={` flex flex-col justify-center content-center items-center align-top lg:align-middle h-dvh space-y-6 lg:space-y-12`} >
            <AvisoModal texto={avisoErro} handler={handleChangeAvisoErro} />
            {
                isLoadingForms &&
                <div className={`z-50 text-black absolute text-[30px] lg:text-[40px] font-extralight blur-none animate-pulse`}>
                    <h1>CARREGANDO</h1>
                </div>
            }
            <div className={`${avisoErro ? "cursor-not-allowed blur-sm" : ""} ${isLoadingForms ? "cursor-not-allowed blur-sm" : ""} w-[85%] lg:w-[25%]`}>
                <div className="flex flex-col shadow-2xl rounded-2xl p-5 lg:p-10 bg-white">
                    <div className="text-center">
                        <h1 className="font-semibold text-black text-[30px] lg:text-[30px] font-coeps">PRIMEIROS PASSOS</h1>
                    </div>
                    <div>
                        <p className="text-slate-950 text-center">Antes de continuar, precisamos de algumas informações para concluir seu cadastro. Não se preocupe, vai ser rapidinho!</p>
                    </div>
                    <div className="flex flex-col space-y-6  pt-4">
                        <div className="flex flex-col space-y-1">
                            <h1 className="text-slate-950">Nome completo</h1>
                            <InputComponent
                                placeholder="Digite seu nome"
                                value={value_name}
                                onChange={handleChangeName}
                            />

                        </div>
                        <div className="flex flex-col space-y-1">
                            <h1 className="text-slate-950">Número de telefone</h1>
                            <div className="flex-1">
                                <InputComponent
                                    type_text="number"
                                    placeholder="Apenas números"
                                    value={value_telefone}
                                    onChange={handleChangeTelefone}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col space-y-1">
                            <h1 className="text-slate-950">Cpf</h1>
                            <div className="flex-1">
                                <InputComponent
                                    type_text="number"
                                    placeholder="Apenas números"
                                    value={value_cpf}
                                    onChange={handleChangeCpf}
                                />
                            </div>
                        </div>
                        <div className="pt-5">
                            <button disabled={isLoadingForms || avisoErro ? "cursor-not-allowed blur-sm" : ""} className={`${avisoErro ? "disabled:" : ""} ${isLoadingForms ? "cursor-not-allowed" : ""} w-full p-2 rounded text-white bg-[#3E4095] font-extralight`}
                                onClick={fetchData}
                            >CONCLUIR</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
//
function AvisoModal({ texto, handler }) {
    if (!texto) {
        return <></>
    }
    return (
        <div className="flex flex-col justify-center items-center content-center z-50 absolute bg-white text-black p-10 space-y-10 shadow-2xl mx-3">
            <h1>{texto}</h1>
            <button className="bg-[#3E4095] text-white px-5 py-1"
                onClick={() => { handler("") }}
            >FECHAR</button>
        </div>
    )
}
//
//
function Card01() {
    return (
        <div className="flex flex-col shadow-2xl rounded-2xl p-5 lg:p-10 bg-white">
            <div className="text-center">
                <h1 className="font-semibold text-black text-[30px] lg:text-[35px]">Primeiros Passos</h1>
            </div>
            <div>
                <p className="text-slate-950 text-center">Antes de continuar, precisamos de algumas informações para concluir seu cadastro. Não se preocupe, vai ser rapidinho!</p>
            </div>
            <div className="flex flex-col space-y-4 pt-4">
                <div className="flex flex-col space-y-1">
                    <h1 className="text-slate-950">Nome completo</h1>
                    <input className="p-[3px] rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder=". . ."></input>
                </div>
                <div className="flex flex-col space-y-1">
                    <h1 className="text-slate-950">Número de telefone</h1>
                    <div className="flex-1">
                        <input className="p-[3px] w-full rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder="Apenas números"></input>
                    </div>
                </div>
                <div className="flex flex-col space-y-1">
                    <h1 className="text-slate-950">Cpf</h1>
                    <div className="flex-1">
                        <input className="p-[3px] w-full rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder="Apenas números"></input>
                    </div>
                </div>
                <div className="pt-5">
                    <button className="w-full p-2 rounded text-white bg-[#3E4095] font-extralight">CONCLUIR</button>
                </div>
            </div>
        </div>



    )
}
//
//
const InputComponent = ({ type_text = "text", placeholder, value, onChange }) => {
    return (
        <div className="flex flex-col text-black">
            <input
                type={type_text}
                className="px-4 py-2 border rounded-lg focus:outline-none"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
        </div>
    );
};
// <input className="p-[3px] rounded border border-gray-300 focus:outline-none focus:border-blue-500" placeholder=". . ."></input>