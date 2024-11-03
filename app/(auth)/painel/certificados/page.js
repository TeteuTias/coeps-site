'use client'
// pages/index.js
import { useEffect, useState } from 'react';
import CardDatas from '@/app/components/CardDatas';
import Link from 'next/link';
import WarningModal from '@/app/components/WarningModal';

import TelaLoading from '@/app/components/TelaLoading';
//
//
export default function Home() {
    const [firstLoading, setFirstLoading] = useState(true)
    const [dataOrganizador, setDataOrganizador] = useState()
    const [isLoadingDeleteOrSend, setIsLoadingDeleteOrSend] = useState(false)
    const [err, setErr] = useState()

    const baixarCertificadoOrganizador = async (componentId) => {
        console.log(componentId)
        setIsLoadingDeleteOrSend(1)
        try {
            const response = await fetch(`/api/get/certificadoOrganizador/${componentId}`, {
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
            // setIsModalError(error.message || "Ocorreu algum erro ao tentar baixar seu arquivo. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS.")
            console.error('Erro ao baixar o arquivo:', error);
        }
        finally {
            // setIsModalError("Seu download foi realizado com sucesso!")
            // setIsLoadingDeleteOrSend(0)
        }
    };


    useEffect(() => {
        // URLs das APIs
        const urls = [
            '/api/get/usuarioOrganizacao',
        ];

        // Função que faz as requisições
        const fetchData = async () => {
            try {

                // Cria um array de Promises para cada URL
                const [result1] = await Promise.all(
                    urls.map(url =>
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`Erro ao buscar dados de ${url}: ${response.statusText}`);
                                }
                                return response.json();
                            })
                    )
                );
                setDataOrganizador(result1.data)

                // Aguarda todas as Promises usando Promise.all
                const results = await Promise.all(fetchPromises);

                // Armazena os resultados no estado
                setData(results);
            } catch (err) {
                // Armazena o erro no estado
                setErr(err.message);
            } finally {
                // Finaliza o carregamento
                setFirstLoading(false);
            }
        };

        fetchData();
    }, []);


    if (firstLoading) {
        return (
            <>
                <TelaLoading />
            </>
        )
    }
    //
    return (
        <>
            <div className='min-h-screen'>
                <div className='bg-[#3E4095] p-5'>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Meus Certificados</h1>
                </div>
                <div className="flex flex-col justify-center content-center items-center relative pt-2 pb-20">
                    <div className=" w-[90%]">
                        <div className="pt-10">
                            <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>O QUE TEMOS AQUI?</h1>
                        </div>
                        <div>
                        </div>
                        <div className="">
                            <p className="text-[#54595f] text-justify">
                                Aqui, você encontrará os certificados das atividades em que participou. Seja como organizador, palestrante ou ouvinte, todas as suas
                                participações
                                receberão certificações. Esses certificados estarão disponíveis neste espaço para que você possa baixá-los facilmente.
                            </p>
                        </div>
                    </div>

                    <div className=" w-[90%]">
                        <div className="pt-10" onClick={() => console.log(dataOrganizador)}>
                            <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>CERTIFICADOS</h1>
                        </div>
                        <div>
                        </div>
                        <div className=" space-y-5">
                            {
                                !dataOrganizador ?
                                    (
                                        <div className=''>
                                            <h1 className="text-[#3E4095] hover:text-[#505191]">Você ainda não possui certificados disponíveis.</h1>
                                            <p className="text-[#54595f] text-justify">
                                                Seus certificados ainda não estão prontos. Mas não se preocupe! Estamos trabalhando para disponibilizá-los o quanto antes!
                                                <span className='text-gray-950 font-bold'> Caso possua alguma dúvida, fique a vontade para entrar em contato com a equipe COEPS.</span>
                                            </p>
                                        </div>
                                    )
                                    : ""
                            }
                            {
                                dataOrganizador ?
                                    (
                                        <>
                                            <div>
                                                <h1 className='font-semibold text-slate-950 text-[20px] lg:text-[20px]'>🗂️ CERTIFICADOS ORGANIZAÇÃO</h1>
                                            </div>
                                            <div className='space-y-4'>
                                                {dataOrganizador.map((value) => {
                                                    return (
                                                        <div key={value._id} onClick={() => console.log(value)} className=''>
                                                            <div className="bg-white shadow-md w-full md:w-[55%] lg:w-[55%] rounded-xl p-5 border-t-2"
                                                                style={{ borderTopColor: value.isOpen ? "#526eff" : "#ff5d52" }}
                                                            >
                                                                <div>
                                                                    <p className='text-red-600 font-bold'>{value.type.toLocaleUpperCase()}</p>
                                                                </div>
                                                                <div className='text-gray-600'>
                                                                    <p>
                                                                        {
                                                                            value.isOpen ?
                                                                                (
                                                                                    <p className='text-blue-950 cursor-pointer'
                                                                                        onClick={()=> baixarCertificadoOrganizador(value._id)}
                                                                                    >Clique para baixar seu certificado.</p>
                                                                                )
                                                                                :
                                                                                (
                                                                                    <p>
                                                                                        Ainda não disponível.
                                                                                    </p>
                                                                                )
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )
                                    : ""
                            }
                        </div>
                    </div>


                </div>
            </div>
        </>

    );

}
/*


*/
