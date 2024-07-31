'use client'
//
import Image from "next/image";
import ImageModal from "@/app/components/ImageModal";
import Waves from "@/app/components/Waves";
import TituloBanner from "@/app/components/TituloBanner";
import { useEffect, useState } from "react";
import ContatoBanner from "@/app/components/ContatoBanner";
//
//
export default function Organizadores() {
    const [loadingData, setLoadingData] = useState(1)
    const [data, setData] = useState(undefined)
    const [selectedType, setSelectedType] = useState("TODOS")

    const handleSelectedTye = (e) => {
        setSelectedType(e)
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/inauthenticated/get/organizadoresImagens');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const responseJson = await response.json();
                setData(responseJson)
            } catch (error) {
                setError(error.message);
            } finally {
                if (loadingData) {
                    setLoadingData(false);
                }
            }
        };

        fetchData();
    }, [loadingData]);

    return (
        <>
            <div className="">
                <div className="relative">
                    <TituloBanner titulo={"comissão organizadora"} />
                    <div className="absolute -bottom-1 left-0 w-full overflo z-20  text-white">
                        <Waves />
                    </div>
                </div>
                <div className="flex content-center justify-center pb-10 pt-10">
                    <div className=" w-[90%] lg:w-2/3 space-y-6 ">
                        <div className="flex content-center justify-center">
                            <h1 className=" text-gray-700 text-justify">
                                O <span className="text-gray-800 font-bold">VI COEPS</span>, desenhado e objetivado pelo DADG, é inteiramente organizado pelos alunos do Centro Universitário IMEPAC Araguari.
                                Tradicionalmente, sempre foi realizado pelos alunos da Medicina, porém essa edição contará com alunos de outros cursos da saúde,
                                como psicologia, enfermagem, educação física, fisioterapia e outros.
                            </h1>
                        </div>
                        <div className="flex flex-col justify-center content-center align-middle items-center">
                            <div className="flex justify-center content-center align-middle items-center">
                                <h1 className={`text-center ${loadingData ? 'text-blue-600' : 'text-gray-700'}`}>
                                    {loadingData ? (
                                        'CARREGANDO'
                                    ) : (!data || data.length === 0) ? (
                                        'Ainda não temos nada disponível.'
                                    ) : (
                                        'Conheça nossa comissão organizadora abaixo!'
                                    )}
                                </h1>
                            </div>
                            <div className="flex flex-wrap gap-4 w-[80%] justify-center content-center align-middle items-center">
                                <div className="flex flex-row space-x-2 flex-wrap w-[100%] justify-center content-center align-middle items-center">
                                    {data?.length > 0 ? (
                                        <div className={`${selectedType == 'TODOS' ? "m-2 bg-gray-800 text-white font-bold" : "bg-white text-gray-800"}  p-1 px-2 shadow-md text-center cursor-pointer`}
                                            onClick={() => { handleSelectedTye("TODOS") }}
                                        >
                                            <p className="text-sm">TODOS</p>
                                        </div>
                                    ) : null}
                                    {data?.map((value, index) => (
                                        <div key={index} className={`${selectedType == value.name ? "m-2 bg-gray-800 text-white font-bold" : "bg-white text-gray-800"} p-1 px-2 shadow-md text-center cursor-pointer`}
                                            onClick={() => { handleSelectedTye(value.name) }}
                                        >
                                            <p className="text-sm">{value.name.toLocaleUpperCase()}</p>
                                        </div>
                                    ))}
                                </div>

                                {/*
                                {selectedType === "TODOS" ? (
*/
                                }
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {
                                    selectedType == "TODOS" ? (
                                        data?.map((value, index) => {
                                            return value.imagesList.map((value2, index) => {
                                                return (
                                                    <div key={index} className="relative w-[100%]">
                                                        <ImageModal src={value2} alt={""} />
                                                    </div>
                                                )
                                            })
                                        })

                                    )
                                        : (
                                            data?.map((value, index) => {
                                                if (value.name != selectedType) {
                                                    return null
                                                }
                                                return value.imagesList.map((value2, index) => {
                                                    return (
                                                        <>
                                                            <ImageModal src={value2} alt={""} />
                                                        </>
                                                    )
                                                })
                                            })
                                        )
                                }


                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ContatoBanner />
        </>
    )
}
//
//
/*

<div className="flex flex-col justify-center items-center content-center space-y-6">
                            <div className="flex flex-wrap gap-4 justify-center w-[80%] ">
                                {
                                    Object.keys(dict_fotos).map((value, index) => {
                                        return (
                                            <div key={index} className={`${index == organizacao_selecionada || "TODAS" == value ? "bg-gray-800 text-white font-bold" : "bg-white text-gray-700"}  p-1 px-2 shadow-md text-center cursor-pointer `}>
                                                <p className="text-sm">{value}</p>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {
                                    lista_fotos.map((value, index) => {
                                        return (
                                            <div key={index} className="relative w-[100%]">
                                                <ImageModal src={value} alt={""} />

                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>

*/
