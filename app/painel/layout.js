'use client'
import HeaderPainel from "../components/HeaderPainel";
//
//
export default function Layout({ children }) {
    //
    // <HeaderPainel /> problema: o layout tem que mudar se o usuário !pagou. E não dá pra ficar verificando aqui toda hora.
    
    return (
        <>
        
        <div className="min-h-screen">
            {children}
        </div>
        </>
    )
}