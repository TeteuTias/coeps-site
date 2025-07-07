
// app/layout.jsx
import Header from '@/app/components/Header';
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



