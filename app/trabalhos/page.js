'use client'
import ContatoBanner from "../components/ContatoBanner"
import TituloBanner from "../components/TituloBanner"
import Header from "../components/Header"
import Link from "next/link"
import CardDatas from "../components/CardDatas"
import { useEffect, useState } from "react"
//
//
export default function Trabalhos() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    //
    //


    //
    //
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch('/api/inauthenticated/get/trabalhosConfig');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setLoading(false);
                setConfig(data);
            } catch (error) {
                setError(error.message);
            } finally {
                if (loading) {
                    setLoading(false);
                }
            }
        };

        fetchConfig();
    }, [loading]);
    return (
        <>
            <Header />
            <div className="">
                <TituloBanner titulo="Trabalhos" />
            </div>
            <div className="flex flex-col justify-center content-center items-center relative pt-10 pb-20">
                <div className="flex flex-col space-y-10 w-[90%] lg:space-y-0 lg:space-x-10 lg:flex-row justify-center content-center items-center">
                    <CardDatas data={config?.data_limite_submissao ? new Date(config.data_limite_submissao).toLocaleDateString().slice(0, 5) : ""} texto="Limite de Submissão" />
                    <CardDatas data={config?.trabalhos_por_usuario ? String(config?.trabalhos_por_usuario).padStart(2, '0') : ""} texto="Trabalhos por autor" />
                    <CardDatas data={config?.autores_por_trabalho ? String(config?.autores_por_trabalho).padStart(2, '0') : ""} texto="Autores por Trabalho" />
                    <CardDatas data={config?.data_publicacao_resultados ? new Date(config?.data_publicacao_resultados).toLocaleDateString().slice(0, 5) : ""} texto="Publicação de resultados" />
                </div>
                <div className=" w-[90%]">
                    <div className="pt-10">
                        <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>Publicações</h1>
                    </div>
                    <div>
                        {loading ?
                            <h1 className="text-[#3E4095] hover:text-[#505191]">◽ CARREGANDO</h1> : ""
                        }
                        {config?.resultados && !loading ?
                            config.resultados.map((value, index) => {
                                return (
                                    <Link href={value.link} key={index} target="_blank">
                                        <h1 className="text-[#3E4095] hover:text-[#505191]">◽ {value.titulo}</h1>
                                    </Link>)

                            })
                            : ""
                        }
                        {!config?.resultados && !loading ?
                            <h1 className="text-[#3E4095] hover:text-[#505191]">◽ Nenhuma publicação foi feita</h1>
                            : ""
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
                    <div className="flex flex-row space-x-10 pt-12">
                        <div>
                            <button className="bg-[#3E4095] text-white p-2 px-4">VER EDITAL</button>
                        </div>
                        <div>
                            <Link href="/painel/trabalhos">
                                <button className="bg-[#3E4095] text-white p-2 px-4">ENVIAR TRABALHO</button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
            <ContatoBanner />
        </>
    )
}
