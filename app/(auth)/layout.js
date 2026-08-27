import { UserProvider } from '@/lib/auth0-client';
import AsaasCustomerSyncRetry from '@/app/components/AsaasCustomerSyncRetry';
import './portal-theme.css';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
            <UserProvider>
                <AsaasCustomerSyncRetry />
                <div className="cieps-auth-shell min-h-screen">
                    {children}
                </div>
            </UserProvider>
        </>
    )
}
