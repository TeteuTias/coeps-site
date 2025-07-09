
// app/layout.jsx
import Header from '@/app/components/Header';
import Image from "next/image";
import './style.home.css';
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
    <div className="footer-section">
      <div className="glass-container w-full max-w-6xl mx-auto">
        <h1 className="letreiro-title">Realização</h1>
        <div className="flex flex-col md:flex-row justify-center items-center gap-8">
          <div className='logo-container'>
            <Image
              src="/LogoImepacDADG.png"
              width={300}
              height={300}
              alt="Logo IMEPAC DADG"
              className="footer-logo"
            />
          </div>
        </div>
      </div>
    </div>
  )
}



