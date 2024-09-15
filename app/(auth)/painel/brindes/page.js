'use client'
// pages/index.js
import { useEffect, useState } from 'react';
import CardDatas from '@/app/components/CardDatas';
import Link from 'next/link';
import WarningModal from '@/app/components/WarningModal';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
//
//
export default function Home() {
    const route = useRouter()
    //
    return (
        <>
            <div className='min-h-screen'>
                <div className='bg-[#3E4095] p-5'>
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Brindes</h1>
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
                                A equipe COEPS está trabalhando muuito para conseguir vários prêmios aos nossos congressistas! Aqui você encontra, brindes e cupons de descontos
                                exclusivos para você!
                            </p>
                        </div>
                    </div>

                    <div className="w-[90%] sm:w-[65%] 2xl:w-[90%] grid grid-cols-1 gap-x-10 gap-y-10 p-4 2xl:grid-cols-3 2xl:gap-2 2xl:gap-x-10 2xl:gap-y-10 lg:grid-cols-2 lg:gap-2 lg:gap-x-10 lg:gap-y-10">

                        <BannerAtividade color={generateHexColor()} activity={{
                            emoji: "🪡",
                            name: "EasySuture",
                            description: "Criamos o cupom 'COEPS2024' com 12% de desconto que poderá ser usado por qualquer participante do evento para compras em nossa loja! O cupom ficará válido até 30 dias após o fim do evento!"
                        }} />

                    </div>

                    <div className=" w-[90%]">
                        <div className="pt-10">
                            <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]"><span></span>Nossos Patrocinadores</h1>
                        </div>
                        <div>
                        </div>
                        <div className="">
                            <Image
                                src="/images/logos/easysuture.png"
                                width={150}
                                height={150}
                                className='cursor-pointer'
                                onClick={()=> route.push("https://easysuture.com.br/")}
                            />
                        </div>
                    </div>

                </div>
            </div>
        </>

    );
}

function generateHexColor() {
    const targetColor = [0x3e, 0x40, 0x95]; // RGB values of #3e4095
    const threshold = 100; // Threshold to avoid colors too close to #3e4095
    const whiteThreshold = 200; // Avoid colors too close to white

    function getRandomHex() {
        return Math.floor(Math.random() * 256);
    }

    function getHexCode(value) {
        return value.toString(16).padStart(2, '0');
    }

    function isStrongColor(red, green, blue) {
        return red > 128 || green > 128 || blue > 128;
    }

    function isCloseToWhite(red, green, blue) {
        return red > whiteThreshold && green > whiteThreshold && blue > whiteThreshold;
    }

    let color;
    do {
        let red, green, blue;

        do {
            red = getRandomHex();
            green = getRandomHex();
            blue = getRandomHex();
        } while (!isStrongColor(red, green, blue) || isCloseToWhite(red, green, blue));

        const distance = Math.sqrt(
            Math.pow(targetColor[0] - red, 2) +
            Math.pow(targetColor[1] - green, 2) +
            Math.pow(targetColor[2] - blue, 2)
        );

        if (distance > threshold) {
            color = `#${getHexCode(red)}${getHexCode(green)}${getHexCode(blue)}`;
        }
    } while (!color);

    return color;
}

const BannerAtividade = ({ activity, userId, color }) => {
    const route = useRouter()
    const push = (e) => {
        route.push(e)
    }
    return (
        <div className="relative bg-white min-h-[600px] max-h-[600px] shadow-2xl">
            <div className="" >
                <div className={`p-[3px]`} style={{ 'backgroundColor': color }} />
                <div className="p-5 space-y-5 h-[520px] overflow-auto relative">
                    <div className="text-center">
                        <h1 className="text-[100px] font-emoji text-gray-800">{activity.emoji}</h1>
                    </div>
                    <div >
                        <h1 className="font-extrabold text-center text-black" >{activity.name.toLocaleUpperCase()}</h1>
                    </div>
                    <div>
                        <h1 className="font-thin text-center text-gray-800">
                            {activity.description}
                        </h1>
                    </div>
                    <h1>{ }</h1>
                </div>
                <div className="flex justify-center ">
                    <button className="p-4 font-bold text-white bg-red-500" onClick={() => push("https://easysuture.com.br/")}>
                        USAR CUPOM!
                    </button>
                </div>
            </div>
        </div>
    )
}

