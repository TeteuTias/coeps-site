'use client'
import Image from "next/image";
import Link from "next/link";
import './style.home.css';

export default function Home() {
  return (
    <main className="home-main-gradient">
      {/* Imagem principal do congresso */}
      <section className="main-image-section">
        <Image
          src="/PaginaP.png"
          width={900}
          height={400}
          alt="Informações do Congresso COEPS"
          className="main-congress-image"
          priority
        />
      </section>

      {/* SOBRE O CONGRESSO */}
      <section className="glass-container w-full max-w-6xl mx-auto mt-8">
        <h1 className="letreiro-title">SOBRE O CONGRESSO</h1>
        <h1 className="text-black">
          O VI Congresso dos Estudantes e Profissionais de Saúde (COEPS), evento tradicional em Araguari, organizado pelo Diretório Acadêmico Diogo Guimarães (DADG) do curso de Medicina do Centro Universitário
          IMEPAC Araguari, acontecerá de 31 de outubro a 03 de novembro de 2024, presencialmente, tendo como tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”, trazendo amplas discussões
          com profissionais de renome sobre o tema, assim como rodas de conversas para disseminação de conhecimento. Objetivamos ainda entender
          essas abordagens nos diferentes tipos de cenários de saúde, trabalhando um tema de grande importância e que se faz pouco presente dentro da nossa formação. Além disso, teremos minicursos diversos, vivências,
          atividades político culturais, visita técnica, submissão e apresentação de trabalhos, entre outros, além de nossa esperada festa de encerramento. Faça sua inscrição e não perca esse grande evento!
        </h1>
        <div className="flex justify-center mt-6">
          <button className="home-btn">
            <Link href="/inscricoes" prefetch={false}>
              <span className="font-coeps text-white">GARANTA SUA VAGA</span>
            </Link>
          </button>
        </div>
      </section>

      {/* EVENTO TRADICIONAL EM ARAGUARI */}
      <section className="glass-container w-full max-w-6xl mx-auto mt-8">
        <h1 className="letreiro-title">EVENTO TRADICIONAL EM ARAGUARI</h1>
        <div className="text-center">
          <p>
            O VI Congresso dos Estudantes e Profissionais de Saúde (COEPS), evento tradicional em Araguari, organizado pelo Diretório Acadêmico Diogo
            Guimarães (DADG) do curso de Medicina do Centro Universitário IMEPAC Araguari, acontecerá de 31 de outubro a 03 de novembro de 2024,
            presencialmente, tendo como tema “Inovação em saúde: Conectando Ciência Moderna ao Cuidado Tradicional”.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch mt-8">
          <div className="glass-container flex-1 min-w-[220px]">
            <h2 className="font-extrabold text-[22px] lg:text-[20px] mb-2">Local do Evento</h2>
            <h3 className="text-red-400 mb-2">-----------</h3>
            <p>O Evento será realizado entre os dias 31 de outubro a 03 de novembro de 2024 no IMEPAC Centro Universitário</p>
          </div>
          <div className="glass-container flex-1 min-w-[220px]">
            <h2 className="font-extrabold text-[22px] lg:text-[20px] mb-2">Programação</h2>
            <h3 className="text-red-400 mb-2">-----------</h3>
            <p>Contaremos com ampla programação, distribuída nos 4 dias do evento, não perca!</p>
          </div>
          <div className="glass-container flex-1 min-w-[220px]">
            <h2 className="font-extrabold text-[22px] lg:text-[20px] mb-2">Palestrantes</h2>
            <h3 className="text-red-400 mb-2">-----------</h3>
            <p>Traremos amplas discussões com profissionais de renome sobre o tema.</p>
          </div>
          <div className="glass-container flex-1 min-w-[220px]">
            <h2 className="font-extrabold text-[22px] lg:text-[20px] mb-2">Trabalhos Científicos</h2>
            <h3 className="text-red-400 mb-2">-----------</h3>
            <p>Com o intuito de incentivar a participação dos acadêmicos, profissionais da saúde e áreas afins em atividades de pesquisa</p>
          </div>
        </div>
      </section>

      {/* INSCRIÇÕES ANTECIPADAS */}
      <section className="glass-container w-full max-w-6xl mx-auto mt-8">
        <h1 className="letreiro-title">INSCRIÇÕES ANTECIPADAS</h1>
        <p className="mb-2">Aproveite o lote inicial com valores especiais</p>
        <h1>--------</h1>
        <div className="flex justify-center mt-4">
          <button className="home-btn">
            <Link href="/inscricoes" prefetch={false}>
              <span className="font-coeps text-white">GARANTA SUA VAGA</span>
            </Link>
          </button>
        </div>
        <div className="text-black p-5 space-y-2 mt-6 bg-white rounded-xl shadow-sm">
          <h2 className="font-bold">Local do Evento</h2>
          <h2 className="font-bold">IMEPAC Centro Universitário</h2>
          <p>Av. Minas Gerais, 1889 – Centro, Araguari – MG, 38444-128. (34) 3249-3900</p>
        </div>
      </section>

      {/* CONTATO */}
      <section className="glass-container w-full max-w-6xl mx-auto mt-8 bg-[#3E4095] text-white">
        <h1 className="letreiro-title" style={{background:'#3E4095', color:'#D8D9DA'}}>CONTATO</h1>
        <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-8 p-2">
          <div className="flex flex-row space-x-2 items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" /></svg>
            <span>vcoeps.dadg@gmail.com</span>
          </div>
          <div className="flex flex-row space-x-2 items-center justify-center cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z" /></svg>
            <Link href="https://api.whatsapp.com/send?phone=5562983306426&text=Olá,%20quero%20falar%20sobre%20o%20COEPS!" prefetch={false} target="_blank"><span>(15) 98812-3011</span></Link>
          </div>
          <div className="flex flex-row space-x-2 items-center justify-center cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-6 h-6"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" /></svg>
            <Link href="https://www.instagram.com/coeps.araguari/" prefetch={false} target="_blank"><span>coeps.araguari</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}