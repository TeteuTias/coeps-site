
// app/layout.jsx
import { UserProvider } from '@auth0/nextjs-auth0/client';
import Header from '@/app/components/Header';

import Link from 'next/link'
import Image from "next/image";
//
//
export default function RootLayout({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}
//Header
//
function Header02() {
  return (
    <div className=" top-0 sticky bg-[#3E4095]  p-4 flex flex-col space-y-10 lg:flex-row lg:border-[1px] lg:items-center lg:justify-center lg:content-center lg:space-x-10 lg:space-y-0 ">
      <div className="hover:text-red-800 ease-in duration-150 cursor-pointer">
        <Image
          src="/Logo01.png"
          width={150}
          height={150}
          alt="Picture of the author"
        />
      </div>
      <div className="hover:text-red-800 ease-in duration-150 cursor-pointer">
        <Link href="/" >Inicio</Link >
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <Link href="/organizadores">Organizadores</Link>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">

        <h1>Palestrantes</h1>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <h1>Programação</h1>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <h1>Inscrições</h1>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <h1>Trabalhos</h1>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <h1>Anais</h1>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <h1>Contato</h1>
      </div>
      <div className=" hover:text-red-800 ease-in duration-150 cursor-pointer">
        <h1>Inscreva-se</h1>
      </div>
      <div className=" hover:text-red-500 ease-in duration-150 cursor-pointer">
        <button className="ease-in duration-150 bg-red-500 px-5 py-2 font-bold hover:bg-white">ÁREA DO CONGRESSITA</button>
      </div>
    </div>
  )
}
//Footer
//
function Footer() {
  return (
    <div className="flex justify-center items-center content-center mt-5 mb-5 bg-white">
      <div className="flex flex-col justify-center items-center content-center">
        <h1 className="font-bold text-[#3e4095] text-[20px]">Realização</h1>
        <div className="flex flex-row space-x-5">
          <div className='bg-black'>
            <Image
              src="/LogoImepacDADG.png"
              width={300}
              height={300}
              alt="Picture of the author"
            />
          </div>
        </div>
      </div>
    </div>
  )
}



