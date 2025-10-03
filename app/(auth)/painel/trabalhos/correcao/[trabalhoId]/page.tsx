"use client"

import { useEffect, useState } from "react"
import { ObjectId } from "bson";
import { useRouter } from "next/navigation";
import { IAcademicWorks } from "@/lib/types/academicWorks/academicWorks.t";
import { ChevronUp, ChevronDown, Paperclip, Link as Linkk, FileText } from "lucide-react";
import DOMPurify from "dompurify";

export default function Page({ params }: { params: Promise<{ trabalhoId: string }> }) {
    const [trabalhoData, setTrabalhoData] = useState<IAcademicWorks | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    useEffect(() => {
        const fetchData = async () => {
            try {

                const { trabalhoId } = await params;
                const response = await fetch(`/api/get/usuariosTrabalhos/${trabalhoId}`);
                if (!response.ok) {
                    // Handle error
                    const errMessage: { message: string } = await response.json();
                    alert(errMessage.message);
                    return;
                }
                const { data }: { data: IAcademicWorks } = await response.json();
                setTrabalhoData(data);
            }
            finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    return (
        <>
            <div>
                {loading && <p className="w-full bg-red-500 text-white text-center">C A R R E G A N D O</p>}
            </div>
            <div>
                {
                    trabalhoData &&
                    <TrabalhoComponent trabalho={trabalhoData} setTrabalhoData={setTrabalhoData} />
                }
            </div>
        </>
    )
}


const TrabalhoComponent: React.FC<{ trabalho: IAcademicWorks, setTrabalhoData: React.Dispatch<React.SetStateAction<IAcademicWorks>> }> = ({ trabalho, setTrabalhoData }) => {
    const [trabalhosMarcadosParaRemocao, setTrabalhosMarcadosParaRemocao] = useState<ObjectId[]>([]);
    return (
        <div className="text-black shadow-md p-10">
            <div className="p-5">
                <div className="text-center">
                    <h2>{trabalho.titulo}</h2>
                </div>
                <div>
                    Status: <span>{trabalho.status}</span>
                </div>
                <div className="">
                    <div className="text-center">
                        <p>Comentários dos Avaliadores</p>
                    </div>
                    <div className="space-y-2">
                        {
                            trabalho.avaliadorComentarios.length === 0 ? <span>Nenhum comentário disponível.</span> :
                                trabalho.avaliadorComentarios.map((comentario, index) => (
                                    <div key={index} className="border p-2 my-2">
                                        <p><strong>Avaliação {index + 1}: {new Date(comentario.date).toLocaleDateString()}</strong></p>
                                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentario.comentario) }} />
                                    </div>
                                ))
                        }
                    </div>
                </div>
                <div>
                    <p className="w-full text-center">Abaixo, você será capaz de realizar as alterações necessárias. Lembre-se, depois de enviado, não tem mais volta.😈</p>
                </div>
                <div className="">
                    <div>
                        <h3 className="w-full text-center">Autores:</h3>
                    </div>
                    <h1>
                        {
                            trabalho.autores.map((autor, index) => (
                                <span key={index}>
                                    {autor.nome}{index < trabalho.autores.length - 1 ? ', ' : ''}
                                </span>
                            ))
                        }
                    </h1>
                </div>
                <div className="w-full text-center">
                    <p>Tópicos</p>
                </div>
                <div className="space-y-2">
                    {
                        Object.entries(trabalho.topicos).map(([key, value]) => (
                            <div key={key}>
                                <h3>{key}</h3>
                                <input type="text" className="text-black" value={value} onChange={(e) => {
                                    const newValue = e.target.value;
                                    setTrabalhoData((prevData) => ({
                                        ...prevData,
                                        topicos: {
                                            ...prevData.topicos,
                                            [key]: newValue
                                        }
                                    }));
                                }} />
                            </div>
                        ))
                    }
                </div>
                <div className="w-full text-center">
                    <p>Arquivos Postados</p>
                    <p>(ARQUIVOS DELETADOS NÃO PODEM SER RECUPERADOS)</p>
                </div>
                <div className="flex items-center justify-center">
                    <input type="file" className="bg-red-500 font-extrabold text-white p-2" />
                </div>
            </div>
            <div className="space-x-5">
                {
                    trabalho.arquivos.map((arquivo, index) => (
                        <div key={index} className="border p-2 my-2 flex justify-between items-center text-black">
                            <div className="flex items-center gap-2">
                                <Paperclip />
                                <a href={arquivo.url} target="_blank" rel="noopener noreferrer" className="underline">
                                    {arquivo.originalName}
                                </a>
                            </div>
                            <div className="text-sm text-gray-800 space-x-5">
                                <span>{(arquivo.size / (1024 * 1024)).toFixed(2)} MB</span> | <span>{new Date(arquivo.uploadDate).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))
                }
            </div>
            <div className="text-black">
                <div className="text-center">
                    <h3 className="w-full text-center">Detalhes dos Autores</h3>
                    <p>Caso queira fazer alguma alteração, entre em contato com a Organização do Congresso.</p>
                </div>
            </div>
        </div >
    );
};