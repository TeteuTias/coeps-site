import HeaderPainel from '@/app/components/HeaderPainel';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>

            <div className="min-h-screen">
                <HeaderPainel />
                {children}
            </div>

        </>
    )
}
