'use client'
//
import Image from "next/image";
import Header from "../components/Header"
import ImageModal from "../components/ImageModal";
//
//
export default function Organizadores(){
    const dict_fotos = {
        "TODAS":"só para lembrar que TODAS possui uma lógica especial.",
        "GERAL": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],        
        "ALIMENTOS": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],          
        "APOIO":[ 
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],          
        "CAPACITAÇÃO": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],          
        "CERTIFICADOS":[ 
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            
        ],          
        "CIENTÍFICA": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],          
        "EVENTOS": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},

        ],          
        "FINANÇAS": [            
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            
        ],          
        "INFRAESTRUTURA": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            
        ],          
        "INTERCURSOS": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],      
        "LIGAS": [

            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],     
        "MARKETING": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],          
        "PROGRAMAÇÃO": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
        ],          
        "PRODUTOS": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            
        ],          
        "SECRETARIADO": [
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},
            {"Jotinha":"https://coeps.com.br/wp-content/uploads/2023/10/5-1.png"},

        ],               
    }
    const lista_fotos = [ // so fiz assim para demostração, por enquanto nao tem separação por coordenadoria
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",
        "https://coeps.com.br/wp-content/uploads/2023/10/5-1.png",

    ]
    var organizacao_selecionada = "TODAS"
    return (
        <>
        <Header/>
        <div className="">
            <div className="bg-[url(Site.jpg)] flex content-center justify-center font-semibold text-[30px] p-16  bg-center bg-cover">
                <h1>Comissão Organizadora</h1>
            </div>
            <div className="flex content-center justify-center pb-10 pt-10">
                <div className=" w-[90%] lg:w-2/3 space-y-6">
                    <div className="flex content-center justify-center">
                        <h1 className=" text-gray-700 text-justify">
                            O <span className="text-gray-800 font-bold">V COEPS</span>, desenhado e objetivado pelo DADG, é inteiramente organizado pelos alunos do Centro Universitário IMEPAC Araguari. 
                            Tradicionalmente, sempre foi realizado pelos alunos da Medicina, porém essa edição contará com alunos de outros cursos da saúde, 
                            como psicologia, enfermagem, educação física, fisioterapia e outros.
                        </h1>
                    </div>
                    <div className="flex content-center justify-center">
                        <h1 className=" text-gray-700 text-center">
                            Conheça nossa comissão organizadora abaixo!
                        </h1>
                    </div>
                    <div className="flex flex-col justify-center items-center content-center space-y-6">
                        <div className="flex flex-wrap gap-4 justify-center w-[80%] ">
                            {
                            Object.keys(dict_fotos).map((value, index) => {
                                return (
                                    <div key={index} className={`${index == organizacao_selecionada || "TODAS" == value?"bg-gray-800 text-white font-bold":"bg-white text-gray-700"}  p-1 px-2 shadow-md text-center cursor-pointer `}>
                                        <p className="text-sm">{value}</p>
                                    </div>
                                )
                            })
                            }
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {
                                lista_fotos.map((value,index)=>{
                                    return (
                                    <div key={index} className="relative w-[100%]">
                                        <ImageModal src={value} alt={""} />

                                    </div>
                                )
                            })
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    )
}
//
//
