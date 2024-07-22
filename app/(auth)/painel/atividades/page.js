'use client'

import HeaderPainel from "@/app/components/HeaderPainel"
//
//
//
export default function Minicursos() {
    const apagar = [1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 9, 0, 0,]
    return (
        <div className="bg-[#3E4095] min-h-screen">
            <div className=" w-full text-center flex items-center justify-center">
                <div className="w-[90%] lg:w-[60%] text-justify p-5">
                    <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px]">Atividades</h1>
                </div>
            </div>
            <div className="flex content-center justify-center w-full text-gray-700 text-clip py-16 bg-white">
                <div className="w-[95%] md:w-[50%]">
                    <h1 className="break-words text-start font-bold text-black text-[22px] lg:text-[18px]">O QUE TEMOS AQUI</h1>
                    <h1 className="text-justify">
                        Aqui, você pode se inscrever em <span className="bg-yellow-300 px-1 font-bold">atividades complementares</span>. É obrigatório que cada participante escolha <span className="font-bold">três</span> dessas atividades. Lembre-se de que cada uma possui um número máximo de participantes, portanto, programe-se para se inscrever a tempo! Não se preocupe, todas as informações necessárias estão disponíveis aqui. Após a inscrição, a atividade será adicionada automaticamente à "Minha Programação".

                    </h1>
                </div>
            </div>
            <div className="flex content-center justify-center w-full text-white text-clip py-16">
                <div className="w-[95%] md:w-[50%]">
                    <h1 className="break-words text-start font-bold text-white text-[22px] lg:text-[18px]">PRECISO PAGAR?</h1>
                    <h1 className="text-justify">
                        Grande parte das atividades é <span className="bg-yellow-300 text-gray-800 font-bold px-1">gratuita</span>. Entretanto, algumas podem ter cobranças simbólicas para viabilizar
                        o evento.  Atividades pagas estão marcadas com <span className="bg-yellow-300 text-gray-800 font-bold px-1">'PAGO'</span>.
                    </h1>
                </div>
            </div>
            <div className="flex content-center justify-center w-full text-gray-700 text-clip py-16 bg-white">
                <div className="w-[95%] md:w-[50%]">
                    <h1 className="break-words text-start font-bold text-black text-[22px] lg:text-[18px]">QUANTAS ATIVIDADES EU POSSO ME INSCREVER?</h1>
                    <h1 className="text-justify">
                        Você pode se inscrever em <span className="bg-yellow-300 text-gray-800 font-bold px-1">03 atividades</span>.
                    </h1>
                </div>
            </div>
            <div className="bg-[#3e4095]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" fill="#FFFFFF" >
                    <path className="" d="M761.9,44.1L643.1,27.2L333.8,98L0,3.8V0l1000,0v3.9"></path>
                </svg>
            </div>
            <div className="flex content-center justify-center w-full text-gray-700 text-clip py-16 ">
                <div className="flex flex-col w-[95%] md:w-[70%]">
                    <div className="text-center">
                        <h1 className="break-words font-bold text-white text-[22px] lg:text-[18px]">TYPE - COLOCAR O TYPE PARA FICAR MAIS FÁCIL |CARREGANDO|MSG QUANDO CARREGADO| MENSAGEM QUANDO NÃO TEM NADA</h1>
                    </div>
                    <div className="flex items-center content-center justify-center">
                        <div className="w-[95%] md:w-[90%] grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-3 lg:gap-2 lg:gap-x-10 lg:gap-y-10 p-4">
                            {
                                apagar.map((index) => {
                                    return (
                                        <BannerAtividade />
                                    )
                                })
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function generateHexColor() {
    const targetColor = [0x3e, 0x40, 0x95]; // RGB values of #3e4095
    const threshold = 100; // Threshold to avoid colors too close to #3e4095

    function getRandomHex() {
        return Math.floor(Math.random() * 256);
    }

    function getHexCode(value) {
        return value.toString(16).padStart(2, '0');
    }

    function isStrongColor(red, green, blue) {
        return red > 128 || green > 128 || blue > 128;
    }

    let color;
    do {
        let red, green, blue;

        do {
            red = getRandomHex();
            green = getRandomHex();
            blue = getRandomHex();
        } while (!isStrongColor(red, green, blue));

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

const BannerAtividade = () => {
    var color = generateHexColor()
    return (
        <div className="relative">
            <div className="absolute  w-fit p-2" style={{ 'backgroundColor': color }}>
                <h1>💲</h1>
            </div>
            <div className=" bg-white shadow-2xl">
                <div className={`p-[3px]`} style={{ 'backgroundColor': color }} />
                <div className="p-5 space-y-5">
                    <div className="text-center">
                        <h1 className="text-[100px]">👨‍⚕️</h1>
                    </div>
                    <div>
                        <h1 className="font-bold text-center">{'Terapia Hormonal de Reposição de Testosterona'.toLocaleUpperCase()}</h1>
                    </div>
                    <div>
                        <h1 className="font-thin text-center">Amanhecer no campo é um espetáculo para os sentidos. O canto dos pássaros saúda o novo dia enquanto a brisa suave espalha o aroma fresco da terra úmida. Os primeiros raios de sol tocam suavemente as folhas das árvores, criando um mosaico de luz e sombra no chão. As flores começam a se abrir, revelando suas cores vibrantes e atraindo abelhas e borboletas. No horizonte, as montanhas se destacam contra o céu azul, prometendo aventuras para aqueles que se atrevem a explorar. É um momento de paz e renovação, onde a natureza revela sua beleza e serenidade em cada detalhe.</h1>
                    </div>
                    <div className="flex justify-center">
                        <button className="p-4 font-bold text-white" style={{ 'backgroundColor': color }}>INSCREVER</button> {/* INSCREVER|JÁ INSCRITO|FECHADO  */}
                    </div>
                </div>
            </div>
        </div>
    )
}