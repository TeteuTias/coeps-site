'use client'
import Image from "next/image"
import { useEffect, useState } from "react";
//
//
export default function Anais() {
  const [anais, setAnais] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  //
  //


  //
  //
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/inauthenticated/get/anais');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setLoading(false);
        // Ordenar a lista com base em date_update
        const sortedData = data.data.sort((a, b) =>
          new Date(a.date_update) - new Date(b.date_update)
        );
        setAnais(sortedData);
      } catch (error) {
        setError(error.message);
      } finally {
        if (loading) {
          setLoading(false);
        }
      }
    };

    fetchConfig();
  }, [loading]);
  return (
    <>
      <div className="min-h-screen">
        <div className="flex-1 min-h-screen">

          <div className="bg-[url(Site.jpg)] flex justify-center items-center content-center font-semibold text-[30px] p-16  bg-center bg-cover ">
            <h1>Anais</h1>
          </div>
          <div className="flex flex-col justify-center items-center content-center p-10">
            <div className=" w-[60%]">

              <div className=" w-full">
                <h1 className="text-black font-bold text-[15px] lg:text-[30px]">Publicações</h1>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-flex">
                {
                  !loading && anais?.length > 0 ? (
                    anais.map((value, index) => {
                      return <CardAnais url="/anais01.png" titulo={value.name} ano={new Date(value.date_update).getFullYear()} key={index}/>
                    })

                  ) : ""
                }
              </div>
              {
                !loading && anais?.length == 0 ?
                  <h1 className="text-[#3E4095]">Ainda não há postagens</h1> : ""
              }
              {
                loading ?
                  <h1 className="text-[#3E4095]">CARREGANDO</h1> : ""
              }
            </div>
          </div>
        </div>
        <div>

          <Header01 />
        </div>
      </div>
    </>
  )
}
//
//
function CardAnais({ url, titulo, ano }) {
  return (
    <div className="flex flex-col justify-center items-center content-center relative w-[100%]">
      <Image
        src={url}
        width={647}
        height={180}
        alt={titulo + " - " + ano}
      />
      <div className="flex flex-col justify-center items-center content-center text-[#3e4095] font-semibold text-center ">
        <h1>{titulo}</h1>
      </div>
      <div className="flex flex-col justify-center items-center content-center text-gray-600 text-center">
        <h1>{ano}</h1>
      </div>
    </div>
  )
}
//
//
function Header01() {
  return (
    <div className="bg-[#3E4095] flex flex-col items-center justify-center content-center p-3" id="ComponenteContados">
      <h1 className=" font-bold text-[20px]">Contato</h1>
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
          <h1>(62) 98330-6426</h1>
        </div>
        <div className="flex flex-row space-x-2 items-center justify-center content-center cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-6 h-6">
            <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
          </svg>
          <h1>Instagram</h1>
        </div>
      </div>
    </div>
  )
}