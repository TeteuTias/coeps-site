'use client'

export default function CardDatas({ data, texto, isLoading }: { data: string, texto: string, isLoading: boolean }) {
    return (
        <div className=" shadow-2xl px-11">
            <div className="">
                {
                    isLoading ?
                        <div className="text-center">
                            <h1 className="text-[#3E4095] text-[51px] font-semibold blur-[3px] animate-pulse">00/00</h1>
                            <h1 className="text-red-800 text-[20px] blur-[3px] animate-pulse">...</h1>
                        </div> :
                        <div className="text-center">
                            <h1 className="text-[#3E4095] text-[51px] font-semibold ">{data}</h1>
                            <h1 className="text-red-800 text-[20px] ">{texto}</h1>
                        </div>
                }
            </div>
        </div>
    )
}