'use client'
// pages/index.js
import { useEffect, useState } from 'react';
import CardDatas from '@/app/components/CardDatas';
import Link from 'next/link';
import WarningModal from '@/app/components/WarningModal';
//
//
export default function Home() {
    
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
                        <div className="pt-10">
                            <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>CERTIFICADOS</h1>
                        </div>
                        <div>
                        </div>
                        <div className=" space-y-5">
                            <h1 className="text-[#3E4095] hover:text-[#505191]">Você ainda não possui certificados disponíveis.</h1>
                            <p className="text-[#54595f] text-justify">
                                Seus certificados ainda não estão prontos. Mas não se preocupe! Estamos trabalhando para disponibilizá-los o quanto antes!
                                <span className='text-gray-950 font-bold'> Caso possua alguma dúvida, fique a vontade para entrar em contato com a equipe COEPS.</span>
                            </p>
                        </div>
                    </div>


                </div>
            </div>
        </>

    );
}
