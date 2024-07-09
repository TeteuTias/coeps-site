import Image from "next/image"
//
//
export default function TelaLoading(){
    return (
        <div className="flex flex-col items-center align-middle content-center justify-center h-screen">
            <div className="w-[310px] lg:w-[580px] space-y-3 lg:space-y-10">
                <Image       
                    src="/LetreiroColorido01.png"
                    width={580}
                    height={180}
                    alt="Picture of the author"
                />
            <div className="text-center animate-pulse">
                <h1 className="text-black">C A R R E G A N D O</h1>
            </div>
            </div>
        </div>
    )
}



// Esse componetne necessita de TODA a tela de preferencia para ficar bonito.