'use client'
// pages/index.js
import { useEffect, useState } from 'react';
import CardDatas from '@/app/components/CardDatas';
import Link from 'next/link';
import WarningModal from '@/app/components/WarningModal';
//
//
export default function Home() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('Você ainda pode enviar xx trabalhos');
    const [data, setData] = useState(
        {
            "data_inicio_submissao": undefined,
            "data_limite_submissao": undefined,
            "data_publicacao_resultados": undefined,
            "autores_por_trabalho": undefined,
            "trabalhos_por_usuario": undefined
        }
    )
    const [dataEnvios, setDataEnvios] = useState([])
    const [isModal, setIsModal] = useState(0)
    const [isLoading, setIsLoading] = useState(1)
    const [isBlock, setIsBlock] = useState(1)
    const [isModalError, setIsModalError] = useState(null)
    //
    const [isLoadingDeleteOrSend, setIsLoadingDeleteOrSend] = useState(0)
    const removeItem = (idToRemove) => {
        // Verificando se vai liberar ou nao
        if (dataEnvios.length == data.trabalhos_por_usuario || dataEnvios.length - 1 >= data.trabalhos_por_usuario) { // Bloqueando se preciso
            if (!isBlock) {
                setIsBlock(1)
            }
        }
        if (dataEnvios.length < data.trabalhos_por_usuario || dataEnvios.length - 1 < data.trabalhos_por_usuario) { // Bloqueando se preciso
            if (isBlock) {
                setIsBlock(0)
            }
        }
        // Fazendo o que tem que fazer
        setDataEnvios((prevItems) => prevItems.filter(item => item._id !== idToRemove));
        setFile(null)

    };
    //
    const handleDataEnvios = (newItem) => {
        setDataEnvios((prevItems) => [...prevItems, newItem]);
    }
    //
    const handleIsModal = (e) => {
        setIsModal(e)
    }
    //
    const handleMessage = (e) => {
        setMessage(e)
    }
    //
    const formatNumber = (num) => {
        return String(num).padStart(2, '0');
    };
    //
    const handleData = (e) => {
        setData(e)
    }
    const handleIsLoading = (e) => {
        setIsLoading(e)
    }
    //
    const handleSubmit = async (e) => {
        if (isLoadingDeleteOrSend) { return 0 }
        setIsLoadingDeleteOrSend(1)
        try {
            // Colocando que tá carregando  
            //
            const MAX_FILE_SIZE = 10 * 1024 * 1024;

            e.preventDefault();

            if (!file) {
                setIsModalError('Selecione um arquivo antes de enviar')
                setMessage('Selecione um arquivo antes de enviar');
                return;
            }
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/post/uploadTrabalho', {
                method: 'POST',
                body: formData,
            });
            // Verificando se o fetch foi OK
            const result = await res.json();
            if (!res.ok) {
                if (res.status == 500) {
                    setIsModalError('ERROR 500. Caso o erro persiste, comunique os organizadores.')
                    return 0
                }
                console.log(result)
                setIsModalError(result.error)
                console.log("!res.ok")
                return 0
            }


            // Depois de dar tudo certo, ele faz algumas coisas..
            if (dataEnvios.length == data.trabalhos_por_usuario || dataEnvios.length + 1 >= data.trabalhos_por_usuario) { // Bloqueando se preciso
                if (!isBlock) {
                    setIsBlock(1)
                }
            }

            // Em fim, fazendo o que ele iria fazer idependente das condições.
            handleDataEnvios(result.data)
            setFile(null)
            setMessage("Trabalho submetido com sucesso!");
            setIsLoadingDeleteOrSend(0)
        }
        catch (error) {
            console.log(error)
        }
        finally {
            setFile(null)
            setIsLoadingDeleteOrSend(0)
        }
    };
    // carregando data
    useEffect(() => {
        const fetchData = async () => {
            //console.log("executou")
            const [response1, response2] = await Promise.all([
                fetch('/api/get/trabalhosConfig', { cache: 'no-cache' }).then(value => value.json()),
                fetch('/api/get/usuariosTrabalhos', { cache: 'no-cache' }).then(value => value.json())
            ]);
            // Setando se ele ainda pode enviar algum arquivo.

            if (response2.data.length < response1.trabalhos_por_usuario) {
                setIsBlock(0)
            }

            // Setando o que eu iria setar de qualquer forma 
            handleData(response1)
            setDataEnvios(response2.data)
            handleIsLoading(0)

        };
        if (isLoading) {
            fetchData()
        }
    }, [isLoading])
    //
    //
    const deletePDF = async (id) => {
        if (isLoadingDeleteOrSend) { return 0 }
        setIsLoadingDeleteOrSend(1)
        try {
            const response = await fetch('/api/delete/usuarioTrabalho', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ "id": id }),
            });

            const data = await response.json();
            // Verificando se tudo certo
            if (!response.ok) {
                console.log(data.erro.message)
                setIsModalError(data.erro.message)
                return 0 // depois vou configurar o erro
            }
            // Verificando se a pessoa pode ou não enviar mais documentos
            if (dataEnvios - 1 < data.trabalhos_por_usuario) { // Como já foi removido, coloco -1
                // Se cair aqui, ele é desbloqueado
                if (isBlock) { // Desbloqueio se não tiver desbloqueado
                    setIsBlock(0)
                }
            }
            if (dataEnvios - 1 >= data.trabalhos_por_usuario) { // Como já foi removido, coloco -1
                // Se cair aqui, ele é desbloqueado
                if (!isBlock) { // Bloqueio se tiver bloqueao
                    setIsBlock(1)
                }
            }
            // Removendo da lista de DataEnvios
            removeItem(id)
        } catch (error) {
            console.error('Erro ao enviar a requisição:', error);
        }
        finally {
            setIsLoadingDeleteOrSend(0)
        }
    };
    //
    //
    return (
        <>
            <WarningModal closeModal={() => { setIsModalError(null) }} message={isModalError} isModal={isModalError} />
            <LoadingModal isLoading={isLoadingDeleteOrSend} />
            <div className='min-h-screen'>
                <div className='bg-[#3E4095] p-5'>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Submissão de Trabalhos</h1>
                </div>
                <div className="flex flex-col justify-center content-center items-center relative pt-10 pb-20">
                    <div className="flex flex-col space-y-10 w-[90%] lg:space-y-0 lg:space-x-10 lg:flex-row justify-center content-center items-center">
                        <CardDatas isLoading={isLoading} data={new Date(data.data_limite_submissao).toLocaleDateString().slice(0, 5)} texto="Limite de Submissão" />
                        <CardDatas isLoading={isLoading} data={formatNumber(data.trabalhos_por_usuario)} texto="Trabalhos por autor" />
                        <CardDatas isLoading={isLoading} data={formatNumber(data.autores_por_trabalho)} texto="Autores por trabalho" />
                        <CardDatas isLoading={isLoading} data={new Date(data.data_publicacao_resultados).toLocaleDateString().slice(0, 5)} texto="Publicação de Resultados" />
                    </div>
                    <div className=" w-[90%]">
                        <div className="pt-10">
                            <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>Publicações Oficiais</h1>
                        </div>
                        <div>
                            {
                                isLoading ?
                                    <div className='text-start'>
                                        <h1 className="text-[#3E4095] hover:text-[#505191] animate-pulse">CARREGANDO</h1>
                                    </div>
                                    : ""
                            }
                            {
                                !isLoading && data?.resultados?.length > 0 ?
                                    (
                                        data.resultados.map((value, index) => {
                                            const KEY = value._id + Math.floor(Math.random() * (999999999999999999999 - 10 + 1)) + 10
                                            return (
                                                <Link href={value?.link ?? ""} target='_blank' key={KEY}>
                                                    <h1 className="text-[#3E4095] hover:text-[#505191]">◽ {value.titulo}</h1>
                                                </Link>
                                            )
                                        })
                                    ) : ""


                            }
                            {
                                !isLoading && data?.resultados?.length == 0 ?
                                    <h1 className="text-[#3E4095] hover:text-[#505191]">Ainda não foram postados resultados</h1> : ""
                            }
                        </div>
                        <div className="pt-10">
                            <p className="text-[#54595f] text-justify">
                                O Diretório Acadêmico Diogo Guimarães (DADG) do curso de graduação em Medicina do Centro Universitário IMEPAC Araguari apresenta o <span className="text-gray-800 font-bold">V Congresso dos Estudantes
                                    e Profissionais de Saúde (COEPS)</span> que possui como tema “Cuidados Paliativos na formação profissional de saúde: humanização em destaque”. Com o intuito de
                                incentivar a participação dos acadêmicos, profissionais da saúde e áreas afins em atividades de pesquisa, visando complementar a formação acadêmica e
                                enriquecer conhecimentos, declara-se aberto o edital para a submissão de trabalhos inéditos pertinentes à área da saúde.
                            </p>
                        </div>
                    </div>
                    <div className=" w-[90%]">
                        <div className="pt-10">
                            <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>Meus Envios</h1>
                        </div>
                        <div className='space-y-2 flex flex-col text-center content-center align-middle justify-center'>
                            {
                                isLoading ?
                                    <div className='text-start'>
                                        <h1 className="text-[#3E4095] hover:text-[#505191] animate-pulse">CARREGANDO</h1>
                                    </div>
                                    : ""
                            }
                            {
                                !isLoading && dataEnvios?.length > 0 ?
                                    (
                                        dataEnvios.map((value, index) => {
                                            const KEY = Math.floor(Math.random() * (999999999999999999999 - 10 + 1)) + 10
                                            return (
                                                <div className='flex flex-row content-center items-center space-x-2' key={KEY}>
                                                    <button onClick={() => {
                                                        //console.log(value)
                                                        deletePDF(value._id)

                                                    }} className='flex font-semibold bg-red-600 hover:bg-red-500 items-center justify-center  text-white rounded-full w-5 h-5 text-xs' disabled={isLoadingDeleteOrSend}>X</button>

                                                    <h1 className="text-[#3E4095] hover:text-[#505191]">{value?.name}</h1>

                                                </div>
                                            )
                                        })
                                    )
                                    : ""
                            }
                            {
                                !isLoading && dataEnvios?.length == 0 ?
                                    <div className='text-start'>
                                        <h1 className="text-[#3E4095] hover:text-[#505191]">Você ainda não realizou nenhum envio</h1>
                                    </div>
                                    : ""
                            }
                        </div>
                        <div className="pt-10">
                            <p className="text-[#54595f] text-justify">
                                Aqui você pode visualizar todos os seus trabalhos já enviados e também tem a opção de enviar novos trabalhos. Se precisar remover algum trabalho que já foi enviado, basta clicar no botão <span className='font-bold'>x</span> vermelho à esquerda de cada item. Para abrir um trabalho enviado, clique diretamente sobre ele.<span className="text-gray-800 font-bold"> Em caso de dúvidas, sinta-se à vontade para entrar em contato com a equipe COEPS</span>. Estamos aqui para ajudar!
                            </p>
                        </div>
                        <div className="flex flex-col items-start pt-12 space-y-2">
                            <div>
                                <p className="text-[#3E4095] hover:text-[#505191]">
                                    {
                                        !isLoading && !isBlock && data?.trabalhos_por_usuario && !file ? `Você ainda pode enviar ${(data.trabalhos_por_usuario - dataEnvios.length).toString().padStart(2, '0')} trabalho(s)`
                                            : <span>Você selecionou o arquivo <span className='font-bold'>{file?.name}</span>.</span>
                                    }
                                    {
                                        !isLoading && isBlock && data?.trabalhos_por_usuario ? "Você atingiu o limite máximo de envios" : ""
                                    }

                                </p>
                            </div>
                            <div className='flex flex-row items-center space-x-5 '>
                                <div className='bg-yellow-200'>
                                    {
                                        isLoading ?
                                            <button className="bg-[#3E4095] text-white p-2 px-4">CARREGANDO</button>
                                            : ""

                                    }
                                    {
                                        !isLoading && data ?
                                            <Link href={data.link_edital} target='_blank'>
                                                <button className="bg-[#3E4095] text-white p-2 px-4">VER EDITAL</button>
                                            </Link>
                                            : ""
                                    }

                                </div>


                                {
                                    !isBlock ?
                                        <div className=''>
                                            <form onSubmit={handleSubmit} className='space-y-4 lg:space-y-0 space-x-5'>
                                                <input
                                                    type="file"
                                                    id="file-upload"
                                                    accept="application/pdf"
                                                    onChange={(e) => {
                                                        setFile(e.target.files[0])
                                                        handleMessage(`Arquivo "${e?.target?.files[0]?.name}" selecionado.`)
                                                    }}
                                                    className='hidden'
                                                />
                                                <label htmlFor='file-upload' className="bg-[#3E4095] text-white p-[9.5px] px-4 cursor-pointer" disabled={isLoadingDeleteOrSend}>{!file ? 'SELECIONAR TRABALHO' : 'TROCAR ARQUIVO'}</label>
                                                {file ?
                                                    <button className="text-white font-extrabold bg-red-500 p-2 px-4" onClick={() => handleIsModal(1)} disabled={isLoadingDeleteOrSend}>ENVIAR TRABALHO</button> : ""
                                                }
                                            </form>

                                            {/* <button className="bg-[#3E4095] text-white p-2 px-4">ENVIAR TRABALHO</button> */}
                                        </div> : ""
                                }



                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>

    );
}

const LoadingModal = ({ isLoading }) => {
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
/*




*/
