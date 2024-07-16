'use client'
import ContatoBanner from "../components/ContatoBanner"
import TituloBanner from "../components/TituloBanner"
import Header from "../components/Header"
import Link from "next/link"
import CardDatas from "../components/CardDatas"
//
//
export default function Trabalhos() {
    return (
        <>
            <Header />
            <div className="">
                <TituloBanner titulo="Trabalhos" />
            </div>
            <div className="flex flex-col justify-center content-center items-center relative pt-10 pb-20">
                <div className="flex flex-col space-y-10 w-[90%] lg:space-y-0 lg:space-x-10 lg:flex-row justify-center content-center items-center">
                    <CardDatas data="00/00" texto="Limite de Submissão" />
                    <CardDatas data="00/00" texto="Limite de Submissão" />
                    <CardDatas data="00/00" texto="Limite de Submissão" />
                    <CardDatas data="00/00" texto="Limite de Submissão" />
                </div>
                <div className=" w-[90%]">
                    <div className="pt-10">
                        <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>Publicações</h1>
                    </div>
                    <div>
                        <Link href="https://coeps.com.br/wp-content/uploads/2023/10/Trabalhos-Submetidos-V-COEPS-Aprovados-e-Reprovados.pdf">
                            <h1 className="text-[#3E4095] hover:text-[#505191]">Trabalhos Submetidos V COEPS</h1>
                        </Link>
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
                            <button className="bg-[#3E4095] text-white p-2 px-4">ENVIAR TRABALHO</button>
                        </div>
                    </div>
                </div>
            </div>
            <ContatoBanner />
        </>
    )
}
