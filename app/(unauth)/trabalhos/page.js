'use client'
import ContatoBanner from "../../components/ContatoBanner"
import TituloBanner from "../../components/TituloBanner"
import Link from "next/link"
import CardDatas from "../../components/CardDatas"
import { useEffect, useState } from "react"
import Waves from "@/app/components/Waves"
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
            <div className="relative">
                <TituloBanner titulo="Trabalhos" />
                <div className="absolute -bottom-1 left-0 w-full overflo z-20  text-white">
                    <Waves />
                </div>
            </div>
            <div className="flex flex-col justify-center content-center items-center relative pt-10 pb-20">
                {
                    loading ?
                        <h1 className="font-semibold text-[#3E4095] text-[25px] lg:text-[30px]"><span></span>CARREGANDO</h1>
                        : config?.isOpen ? (
                            <div className="flex flex-col space-y-10 w-[90%] lg:space-y-0 lg:space-x-10 lg:flex-row justify-center content-center items-center">
                                <CardDatas data={config?.data_limite_submissao ? new Date(config.data_limite_submissao).toLocaleDateString().slice(0, 5) : ""} texto="Limite de Submissão" />
                                <CardDatas data={config?.trabalhos_por_usuario ? String(config?.trabalhos_por_usuario).padStart(2, '0') : ""} texto="Trabalhos por autor" />
                                <CardDatas data={config?.autores_por_trabalho ? String(config?.autores_por_trabalho).padStart(2, '0') : ""} texto="Autores por Trabalho" />
                                <CardDatas data={config?.data_publicacao_resultados ? new Date(config?.data_publicacao_resultados).toLocaleDateString().slice(0, 5) : ""} texto="Publicação de resultados" />
                            </div>
                        ) :
                            <div className="flex flex-col space-y-10 w-[90%] justify-center content-center items-center">
                                <h1 className="text-[#54595f]">
                                    Ainda não definimos a data para a abertura das submissões de trabalhos. No entanto, não se preocupe! Acompanhe nosso site
                                    e nossas redes sociais para receber as atualizações mais recentes e ficar por dentro das próximas datas.
                                </h1>
                            </div>
                }
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

                                    <h1 className="text-[#3E4095] hover:text-[#505191] w-fit" key={index}><Link href={value.link} target="_blank" prefetch={false}>◽ {value.titulo}</Link></h1>
                                )

                            })
                            : ""
                        }
                        {!config?.resultados && !loading ?
                            <h1 className="text-[#3E4095] hover:text-[#505191]">◽ Nenhuma publicação foi feita</h1>
                            : ""
                        }
                    </div>
                    <div className="pt-10">
                        {
                            !loading && config?.isOpen ?
                                <p className="text-[#54595f] text-justify">
                                    O Diretório Acadêmico Diogo Guimarães (DADG) do curso de graduação em Medicina do Centro Universitário IMEPAC Araguari apresenta o <span className="text-gray-800 font-bold">VI Congresso dos Estudantes
                                        e Profissionais de Saúde (COEPS)</span> que possui como tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”. Com o intuito de
                                    incentivar a participação dos acadêmicos, profissionais da saúde e áreas afins em atividades de pesquisa, visando complementar a formação acadêmica e
                                    enriquecer conhecimentos, declara-se aberto o edital para a submissão de trabalhos inéditos pertinentes à área da saúde.
                                </p> :
                                <p className="text-[#54595f] text-justify">
                                    O Diretório Acadêmico Diogo Guimarães (DADG) do curso de Medicina do Centro Universitário IMEPAC Araguari está preparando o <span className="text-gray-800 font-bold">VI Congresso dos Estudantes e Profissionais
                                        de Saúde (COEPS)</span>, com o tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”.
                                    Atualmente, o edital para a submissão de trabalhos inéditos ainda não está aberto. No entanto, em breve, divulgaremos mais
                                    informações sobre como participar e submeter suas pesquisas. Fique atento ao nosso site e às nossas redes sociais para atualizações e detalhes sobre o processo de submissão.
                                </p>
                        }
                    </div>
                    {
                        !loading && config?.isOpen ?
                            <div className="flex flex-row space-x-10 pt-12">
                                <Link href={config?.link_edital ?? ""} target="_blank" prefetch={false}>
                                    <div>
                                        <button className="bg-[#3E4095] text-white p-2 px-4">
                                            {config?.link_edital ? "VER EDITAL" : "CARREGANDO"}
                                        </button>

                                    </div>
                                </Link>
                                <div>
                                    <Link href="/painel/trabalhos" prefetch={false}>
                                        <button className="bg-[#3E4095] text-white p-2 px-4">ENVIAR TRABALHO</button>
                                    </Link>
                                </div>
                            </div>
                            : ""
                    }
                </div>
            </div >
            <div>
                <div className="relative top-1 left-0 w-full overflo z-20  text-white">
                    <Waves2 />
                </div>
                <div className=" relative">
                    <ContatoBanner />
                </div>
            </div>
        </>
    )
}
const Waves2 = () => {
    return (
        <div className="relative w-full overflow-hidden h-[15vh] min-h-[100px] max-h-[150px]">
            <svg
                className="absolute w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 24 150 28"
                preserveAspectRatio="none"
                shapeRendering="auto"
            >
                <defs>
                    <path
                        id="gentle-wave"
                        d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
                    />
                </defs>
                <g className="parallax">
                    <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(62, 64, 149,0.7)" />
                    <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(62, 64, 149,0.5)" />
                    <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(62, 64, 149,0.3)" />
                    <use xlinkHref="#gentle-wave" x="48" y="7" fill="#3e4095" />
                </g>
            </svg>
        </div>
    );
};