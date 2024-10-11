'use client'
import { upload } from '@vercel/blob/client';

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

    const [messageBlock, setMessageBlock] = useState("")

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
    const [isBlock, setIsBlock] = useState(0)
    const [isModalError, setIsModalError] = useState(null)
    //
    const [isLoadingDeleteOrSend, setIsLoadingDeleteOrSend] = useState(0)


    const baixarArquivo = async (fileId) => {
        setIsLoadingDeleteOrSend(1)
        try {
            const response = await fetch(`/api/get/baixarTrabalhoUsuario/${fileId}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Erro ao fazer o download do arquivo');
            }

            // Extrair o nome do arquivo do cabeçalho
            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition
                ? contentDisposition.split('filename=')[1]
                : 'downloaded_file';

            // Criar um blob a partir do stream de resposta
            const blob = await response.blob();

            // Criar um link temporário para download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace(/"/g, ''); // Remover aspas do nome do arquivo, se houver
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url); // Limpar o URL temporário
        } catch (error) {
            setIsModalError(error.message || "Ocorreu algum erro ao tentar baixar seu arquivo. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS.")
            console.error('Erro ao baixar o arquivo:', error);
        }
        finally {
            setIsModalError("Seu download foi realizado com sucesso!")
            setIsLoadingDeleteOrSend(0)
        }
    };


    const removeItem = (idToRemove) => {
        // Verificando se vai liberar ou nao
        if (dataEnvios.length == data.trabalhos_por_usuario || dataEnvios.length - 1 >= data.trabalhos_por_usuario) { // Bloqueando se preciso
            if (!isBlock) {
                //setIsBlock(1)
                //setMessageBlock("Você já atingiu seu limite máximo de envios. Em caso de dúvidas, entre em contato com a equipe COEPS.")
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

            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/post/uploadTrabalho2',
            });
            setBlob(newBlob)

            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/post/uploadTrabalho', {
                method: 'POST',
                body: formData,
            });
            // Verificando se o fetch foi OK
            const result = await res.json();
            if (!res.ok) {
                /*
                if (res.status == 500) {
                    setIsModalError('ERROR 500. Caso o erro persiste, comunique os organizadores.')
                    return 0
                }
                */
                setIsModalError(result.message || "Ocorreu algum erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS.")
                console.log("!res.ok")
                return 0
            }
            if (res.status == 413) {
                /*
if (res.status == 500) {
    setIsModalError('ERROR 500. Caso o erro persiste, comunique os organizadores.')
    return 0
}
*/
                setIsModalError(result.message || "Ocorreu algum erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS.")
                console.log("!res.ok")
                return 0
            }


            // Depois de dar tudo certo, ele faz algumas coisas..
            if (dataEnvios.length == data.trabalhos_por_usuario || dataEnvios.length + 1 >= data.trabalhos_por_usuario) { // Bloqueando se preciso
                if (!isBlock) {
                    //setIsBlock(1)
                    // setMessageBlock("Você já atingiu seu limite máximo de envios. Em caso de dúvidas, entre em contato com a equipe COEPS.")
                }
            }

            // Em fim, fazendo o que ele iria fazer idependente das condições.
            handleDataEnvios(result.data)
            setFile(null)
            setIsModalError("Arquivo enviado com sucesso!")
            // setMessage("Arquivo enviado com sucesso!");
            setIsLoadingDeleteOrSend(0)
        }
        catch (error) {
            console.log(error)
            setMessage(error.message || "Ocorreu algum erro. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS.");

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


            // ----

            const dataAtual = new Date();

            // Definir as datas de início e fim da submissão em UTC
            const dataInicioSubmissaoUTC = new Date(response1.data_inicio_submissao);
            const dataLimiteSubmissaoUTC = new Date(response1.data_limite_submissao);

            // Definir o offset para o fuso horário -03:00 (em horas)
            const fusoOffset = -3; // Offset em horas

            // Ajustar a data atual para o fuso horário -03:00
            const offsetAtual = dataAtual.getTimezoneOffset() / 60; // Offset do sistema em horas
            const dataAtualAjustada = new Date(dataAtual.getTime() + (offsetAtual - fusoOffset) * 3600000);

            // Ajustar as datas de início e fim da submissão para o fuso horário -03:00
            const dataInicioSubmissaoAjustada = new Date(dataInicioSubmissaoUTC.getTime() + fusoOffset * 3600000);
            const dataLimiteSubmissaoAjustada = new Date(dataLimiteSubmissaoUTC.getTime() + fusoOffset * 3600000);

            // Verificar se a data atual está dentro do intervalo ajustado
            if (dataAtualAjustada >= dataInicioSubmissaoAjustada && dataAtualAjustada <= dataLimiteSubmissaoAjustada) {
                // Não faz nada :|
            } else {
                setIsBlock(1)
                setMessageBlock("Infelizmente, o prazo para a submissão de trabalhos se encerrou. Caso tenha alguma dúvida ou precise de assistência, fique à vontade para entrar em contato com a equipe COEPS. Estamos aqui para ajudar!")
            }

            // ----

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
                setIsModalError(data.message)
                return 0 // depois vou configurar o erro
            }
            setIsModalError(data.message)
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
                    setMessageBlock("Você já atingiu seu limite máximo de envios. Em caso de dúvidas, entre em contato com a equipe COEPS.")
                    //setIsBlock(1)
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
    /*
    return (
        <>
            <div className='bg-[#3E4095] h-screen w-screen flex items-center justify-center flex-col'>
                <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Página em Manutenção</h1>
                <p className="break-words text-center font-extrabold text-white text-[22px] lg:text-[15px]">Voltamos já!</p>

            </div>
        </>
    )
    */
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
                        {
                            isLoading ? (
                                <>
                                    <CardDatas isLoading={isLoading} data={new Date(data.data_limite_submissao).toLocaleDateString().slice(0, 5)} texto="Limite de Submissão" />
                                    <CardDatas isLoading={isLoading} data={formatNumber(data.trabalhos_por_usuario)} texto="Trabalhos por autor" />
                                    <CardDatas isLoading={isLoading} data={new Date(data.data_publicacao_resultados).toLocaleDateString().slice(0, 5)} texto="Publicação de Resultados" />
                                </>

                            ) : !isLoading && isBlock ?
                                <div className="flex flex-col space-y-10 justify-center content-center items-center">
                                    <h1 className="text-[#54595f]">
                                        {messageBlock}
                                    </h1>
                                </div>
                                :
                                <>
                                    <CardDatas isLoading={isLoading} data={new Date(data.data_limite_submissao).toLocaleDateString().slice(0, 5)} texto="Limite de Submissão" />
                                    <CardDatas isLoading={isLoading} data={formatNumber(data.trabalhos_por_usuario)} texto="Trabalhos por autor" />
                                    <CardDatas isLoading={isLoading} data={new Date(data.data_publicacao_resultados).toLocaleDateString().slice(0, 5)} texto="Publicação de Resultados" />
                                </>
                        }
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
                                                <Link href={value?.link ?? ""} target='_blank' key={KEY} prefetch={false}>
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
                            {
                                !isLoading && data?.isOpen ?
                                    <p className="text-[#54595f] text-justify">
                                        O Diretório Acadêmico Diogo Guimarães (DADG) do curso de graduação em Medicina do Centro Universitário IMEPAC Araguari apresenta o <span className="text-gray-800 font-bold">VI Congresso dos Estudantes
                                            e Profissionais de Saúde (COEPS)</span> que possui como tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”. Com o intuito de
                                        incentivar a participação dos acadêmicos, profissionais da saúde e áreas afins em atividades de pesquisa, visando complementar a formação acadêmica e
                                        enriquecer conhecimentos, declara-se aberto o edital para a submissão de trabalhos inéditos pertinentes à área da saúde.
                                    </p> :
                                    !isLoading && !data?.isOpen ?
                                        <p className="text-[#54595f] text-justify">
                                            O Diretório Acadêmico Diogo Guimarães (DADG) do curso de Medicina do Centro Universitário IMEPAC Araguari está preparando o <span className="text-gray-800 font-bold">VI Congresso dos Estudantes e Profissionais
                                                de Saúde (COEPS)</span>, com o tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”.
                                            <span className="text-gray-800 font-bold">Atualmente, o edital para a submissão de trabalhos inéditos ainda não está aberto</span>. No entanto, em breve, divulgaremos mais
                                            informações sobre como participar e submeter suas pesquisas. Fique atento ao nosso site e às nossas redes sociais para atualizações e detalhes sobre o processo de submissão.
                                        </p> : ""
                            }
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

                            <div className="pt-2">
                                {
                                    !isLoading ?
                                        <p className="text-[#54595f] text-justify">
                                            Aqui você pode visualizar todos os seus arquivos já enviados e também tem a opção de enviar novos arquivos. Se precisar remover
                                            algum arquivo que já foi enviado, basta clicar no botão <span className='font-bold'>x</span> vermelho à esquerda de cada item.
                                            <span className='bg-yellow-300 px-1'>É possível <span className='font-bold text-gray-800'>baixar</span> seu arquivo enviado clicando sobre ele.</span>
                                            <span className="text-gray-800 font-bold"> Em caso de dúvidas,
                                                sinta-se à vontade para entrar em contato com a equipe COEPS</span>. Estamos aqui para ajudar!
                                        </p>
                                        : ""
                                }
                            </div>
                            {
                                !isLoading && dataEnvios?.length == 0 ?
                                    <div className='text-start'>
                                        <h1 className="text-[#3E4095] hover:text-[#505191]">Você ainda não realizou nenhum envio</h1>
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

                                                    <h1 className=" cursor-pointer text-[#3E4095] hover:text-[#505191]"
                                                        onClick={() => { baixarArquivo(value._id) }}
                                                    >{value?.name}</h1>

                                                </div>
                                            )
                                        })
                                    )
                                    : ""
                            }
                        </div>
                        {
                            !isLoading && data?.isOpen ?
                                <div className="items-start pt-12 space-y-2">
                                    <div className=''>
                                        <p className="text-[#3E4095] hover:text-[#505191]">
                                            {
                                                !isLoading && !isBlock && data?.trabalhos_por_usuario && !file ? "Você ainda não selecionou um Arquivo." : ""
                                            }                                            {/*
                                                !isLoading && !isBlock && data?.trabalhos_por_usuario && !file ? `Você ainda pode enviar ${(data.trabalhos_por_usuario - dataEnvios.length).toString().padStart(2, '0')} arquivo(s)`
                                                    : ""
                                            */}
                                            {
                                                !isLoading && !isBlock && data?.trabalhos_por_usuario && file ? <span>Você selecionou o Arquivo: <span className='font-bold'>{file?.name}</span>.</span> : ""
                                            }
                                            {
                                                isLoading ? <span>CARREGANDO</span> : ""

                                            }
                                            {
                                                !isLoading && isBlock && data?.trabalhos_por_usuario ? "Você atingiu o limite máximo de envios" : ""
                                            }

                                        </p>
                                    </div>
                                    <div className='flex flex-col sm:flex-row items-start sm:items-center '>

                                        {
                                            isLoading ?
                                                <button className="bg-[#3E4095] text-white p-2 px-4">CARREGANDO</button>
                                                : ""

                                        }
                                        {
                                            !isLoading && data ?
                                                <Link href={data.link_edital} target='_blank' prefetch={false}>
                                                    <button className="bg-[#3E4095] text-white p-2 px-4">VER EDITAL</button>
                                                </Link>
                                                : ""
                                        }

                                        {
                                            !isBlock ?
                                                <div className=''>
                                                    <form onSubmit={
                                                        (e) => {
                                                            e.target.reset()
                                                            handleSubmit(e)
                                                        }
                                                    } className='flex flex-col  space-y-4 lg:space-y-0 space-x-5'>
                                                        <input
                                                            type="file"
                                                            id="file-upload"
                                                            accept="application/pdf, .doc, .docx, .pptx"
                                                            onChange={(e) => {
                                                                console.log(e.target.files)
                                                                setFile(e.target.files[0])
                                                                handleMessage(`Arquivo "${e?.target?.files[0]?.name}" selecionado.`)

                                                            }}
                                                            className='hidden'
                                                        />
                                                        <label htmlFor='file-upload' className="bg-[#3E4095] text-white p-[9.5px] px-4 cursor-pointer" disabled={isLoadingDeleteOrSend}>{!file ? 'SELECIONAR ARQUIVO' : 'TROCAR ARQUIVO'}</label>
                                                        {file ?
                                                            <button className="text-white font-extrabold bg-red-500 " onClick={() => handleIsModal(1)} disabled={isLoadingDeleteOrSend}>ENVIAR ARQUIVO</button> : ""
                                                        }
                                                    </form>

                                                    {/* <button className="bg-[#3E4095] text-white p-2 px-4">ENVIAR TRABALHO</button> */}
                                                </div> : ""
                                        }



                                    </div>
                                </div> : ""
                        }
                    </div>
                </div>
            </div>
        </>

    );
}
//{'<CardDatas isLoading={isLoading} data={formatNumber(data.autores_por_trabalho)} texto="Autores por trabalho" />'}
// {'<CardDatas isLoading={isLoading} data={formatNumber(data.autores_por_trabalho)} texto="Autores por trabalho" />'}

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
