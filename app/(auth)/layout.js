import { UserProvider } from '@/lib/auth0-client';
import './portal-theme.css';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
            <UserProvider>
                <div className="cieps-auth-shell min-h-screen">
                    {children}
                </div>
            </UserProvider>
        </>
    )
}
