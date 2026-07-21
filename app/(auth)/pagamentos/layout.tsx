import { UserProvider } from '@/lib/auth0-client';
import HeaderPainel from '@/app/components/HeaderPainel';
import '../painel/style.css';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
            <UserProvider>
                <div className="cieps-payment-shell min-h-screen">
                    <HeaderPainel isPayed={true} />
                    <div className="pt-14 lg:pt-16">
                        {children}
                    </div>
                </div>
            </UserProvider>

        </>
    )
}
