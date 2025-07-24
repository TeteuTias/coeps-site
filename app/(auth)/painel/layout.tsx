
import HeaderPainel from '@/app/components/HeaderPainel';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
            <div className="min-h-screen">
                <HeaderPainel isPayed={true} />
                <div className="pt-14 lg:pt-16">
                {children}
                </div>
            </div>
        </>
    )
}
