'use client'
import Image from "next/image";
import Link from "next/link";
//
//


export default function Home() {
  //
  //
  /*
  <h1 className="text-black">{user?"Voce está logado":"Voce não está logado"}</h1>
  */
  return (
    <main className="">
      <div className="relative bg-[url(Site.jpg)] bg-center bg-cover pt-12">
        <Letreiro />
        <div className="absolute -bottom-1 left-0 w-full overflo z-20  text-white">
          <Waves />
        </div>
      </div>
      <div className="flex justify-center items-center content-center text-justify p-5">
        <TextoDIV1 />
      </div>
      <div className="relative text-white flex flex-col justify-center items-center content-center text-justify">
        <div className="relative top-2 left-0 w-full overflo z-20  text-white">
          <Waves2 />
        </div>
        <div className="bg-[#3e4095] flex justify-center">
          <TextoDIV2 />
        </div>
      </div>
      <div className="bg-white relative mb-10" >
        <BannerDIV4 />
      </div>
      <Header01 />

    </main>
  );
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
const Waves = () => {
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
          <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7)" />
          <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />
          <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />
          <use xlinkHref="#gentle-wave" x="48" y="7" fill="#fff" />
        </g>
      </svg>
    </div>
  );
};
function Header01() {
  return (
    <div className="bg-[#3E4095] flex flex-col items-center justify-center content-center p-3" id="ComponenteContados">
      <h1 className="p-5 text-[20px] font-coeps text-white">CONTATO</h1>
      <div className="flex p-2 flex-col space-y-10 lg:flex-row lg:items-center lg:justify-center lg:content-center lg:space-x-10 lg:space-y-0 ">
        <div className="flex flex-row space-x-2 items-center justify-center content-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5">
            <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" />
          </svg>
          <h1>vcoeps.dadg@gmail.com</h1>
        </div>
        <div className="flex flex-row space-x-2 items-center justify-center content-center cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5">
            <path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z" />
          </svg>
          <Link href="https://api.whatsapp.com/send?phone=5562983306426&text=Olá,%20quero%20falar%20sobre%20o%20COEPS!" prefetch={false} target="_blank"><h1>(15) 98812-3011</h1></Link>
        </div>
        <div className="flex flex-row space-x-2 items-center justify-center content-center cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-6 h-6">
            <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
          </svg>
          <Link href="https://www.instagram.com/coeps.araguari/" prefetch={false} target="_blank"><h1>coeps.araguari</h1></Link>
        </div>
      </div>
    </div>
  )
}
// Premeiro DIV
function Letreiro() {
  return (
    <div className="flex flex-col space-y-10 justify-center items-center content-center p-10 min-h-[500px]">
      <Image
        src="/Letreiro01.png"
        width={647}
        height={180}
        alt="Picture of the author"
      />
      <Image
        src="/Letreiro03.png"
        width={400}
        height={180}
        alt="Picture of the author"
      />
    </div>
  )
}
// Segundo DIV
//
function TextoDIV1() {
  return (
    <div className="w-[90%] lg:w-[70%] space-y-5">
      <h1 className="text-center font-semibold text-slate-950 text-[30px] lg:text-[30px] font-coeps">SOBRE O CONGRESSO</h1>
      <h1 className="text-black">
        O VI Congresso dos Estudantes e Profissionais de Saúde (COEPS), evento tradicional em Araguari, organizado pelo Diretório Acadêmico Diogo Guimarães (DADG) do curso de Medicina do Centro Universitário
        IMEPAC Araguari, acontecerá de 31 de outubro a 03 de novembro de 2024, presencialmente, tendo como tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”, trazendo amplas discussões
        com profissionais de renome sobre o tema, assim como rodas de conversas para disseminação de conhecimento. Objetivamos ainda entender
        essas abordagens nos diferentes tipos de cenários de saúde, trabalhando um tema de grande importância e que se faz pouco presente dentro da nossa formação. Além disso, teremos minicursos diversos, vivências,
        atividades político culturais, visita técnica, submissão e apresentação de trabalhos, entre outros, além de nossa esperada festa de encerramento. Faça sua inscrição e não perca esse grande evento!
      </h1>

      <button className="bg-[#3e4095] px-5 py-2">
        <Link href={"/inscricoes"} className="pt-40" prefetch={false}>
          <p className="font-coeps text-white">GARANTA SUA VAGA</p>
        </Link>
      </button>


    </div>
  )
}
//
// Terceiro DIV
function TextoDIV2() {
  return (
    <div className="flex flex-col w-[90%] lg:w-[70%] space-y-5 pb-10 p-10 ">
      <div className="flex justify-center items-center content-center text-center">
        <h1 className="font-semibold text-[30px] lg:text-[30px] font-coeps text-white">EVENTO TRADICIONAL EM ARAGUARI</h1>
      </div>
      <div className="text-center">
        <p>
          O VI Congresso dos Estudantes e Profissionais de Saúde (COEPS), evento tradicional em Araguari, organizado pelo Diretório Acadêmico Diogo
          Guimarães (DADG) do curso de Medicina do Centro Universitário IMEPAC Araguari, acontecerá de 31 de outubro a 03 de novembro de 2024,
          presencialmente, tendo como tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”.
        </p>
      </div>
      <div className="flex flex-col space-y-10 lg:space-y-0 lg:flex-row lg:space-x-10 justify-center items-center content-center pt-[50px]">
        <div className="flex flex-col justify-center items-center content-center text-white">
          <div className="flex flex-col justify-center items-center content-center">
            <h1 className="font-extrabold text-[22px] lg:text-[20px]">Local do Evento</h1>
            <h1 className="text-red-400">-----------</h1>
          </div>
          <div className="text-center">
            <p className="break-words">O Evento será realizado entre os dias 31 de outubro a 03 de novembro de 2024 no IMEPAC Centro Universitário</p>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center content-center text-white">
          <div className="flex flex-col justify-center items-center content-center">
            <h1 className="font-extrabold text-[22px] lg:text-[20px]">Programação</h1>
            <h1 className="text-red-400">-----------</h1>
          </div>
          <div className="text-center">
            <p className="break-words">Contaremos com ampla programação, distribuída nos 4 dias do evento, não perca!</p>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center content-center text-white">
          <div className="flex flex-col justify-center items-center content-center">
            <h1 className="font-extrabold text-[22px] lg:text-[20px]">Palestrantes</h1>
            <h1 className="text-red-400">-----------</h1>
          </div>
          <div className="text-center">
            <p className="break-words">Traremos amplas discussões com profissionais de renome sobre o tema.</p>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center content-center text-white">
          <div className="flex flex-col justify-center items-center content-center">
            <h1 className="font-extrabold text-[22px] lg:text-[20px]">Trabalhos Científicos</h1>
            <h1 className="text-red-400">-----------</h1>
          </div>
          <div className="text-center">
            <p className="break-words">Com o intuito de incentivar a participação dos acadêmicos, profissionais da saúde e áreas afins em atividades de pesquisa</p>
          </div>
        </div>


      </div>
    </div>
  )
}
//
// Quarto DIV
function BannerDIV4() {
  return (
    <div className="">
      <svg className="relative -top-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" fill="#3e4095" >
        <path className="" d="M761.9,44.1L643.1,27.2L333.8,98L0,3.8V0l1000,0v3.9"></path>
      </svg>
      <div className=" flex flex-col justify-center items-center lg:items-start content-center lg:flex-row space-y-12 lg:space-y-0 lg:space-x-12 p-7">
        <div className="w-fit text-[#2c3e50]">
          <h1 className="font-bold text-[25px] lg:text-[30px] font-coeps text-[#2c3e50] ">INSCRIÇÕES ANTECIPADAS</h1>
          <p>Aproveite o lote inicial com valores especiais</p>
          <h1>--------</h1>
          <button className="bg-[#3e4095] px-5 py-2 font-coeps text-white"><Link href="/inscricoes" prefetch={false}>GARANTA SUA VAGA</Link></button>
        </div>
        <div className="w-[335px] lg:w-[600px] bg-[#EAEAEA]">
          <Image
            src="/Imepac.png"
            width={850}
            height={550}
            alt="Picture of the author"
          />
          <div className="bg-yellow-300 flex content-center items-center justify-center relative">
            <div className="bg-yellow-400 border-[4px] boreder-[#3e4095] w-fit p-3 lg:p-5 rounded-full absolute">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" className="w-5 h-5 lg:w-10 lg:h-10 text-blue-500">
                <path fill="#FFFFFF" d="M408 120c0 54.6-73.1 151.9-105.2 192c-7.7 9.6-22 9.6-29.6 0C241.1 271.9 168 174.6 168 120C168 53.7 221.7 0 288 0s120 53.7 120 120zm8 80.4c3.5-6.9 6.7-13.8 9.6-20.6c.5-1.2 1-2.5 1.5-3.7l116-46.4C558.9 123.4 576 135 576 152V422.8c0 9.8-6 18.6-15.1 22.3L416 503V200.4zM137.6 138.3c2.4 14.1 7.2 28.3 12.8 41.5c2.9 6.8 6.1 13.7 9.6 20.6V451.8L32.9 502.7C17.1 509 0 497.4 0 480.4V209.6c0-9.8 6-18.6 15.1-22.3l122.6-49zM327.8 332c13.9-17.4 35.7-45.7 56.2-77V504.3L192 449.4V255c20.5 31.3 42.3 59.6 56.2 77c20.5 25.6 59.1 25.6 79.6 0zM288 152a40 40 0 1 0 0-80 40 40 0 1 0 0 80z" />
              </svg>
            </div>
          </div>
          <div className="text-black p-5 space-y-2">
            <h1 className="font-bold">
              Local do Evento
            </h1>
            <h1 className="font-bold">
              IMEPAC Centro Universitário
            </h1>
            <p>
              Av. Minas Gerais, 1889 – Centro, Araguari – MG, 38444-128. (34) 3249-3900
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
//
// Footer


//<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>