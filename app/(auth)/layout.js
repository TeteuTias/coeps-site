import { UserProvider } from '@auth0/nextjs-auth0/client';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
            <UserProvider>
                <div className="min-h-screen">
                    {children}
                </div>
            </UserProvider>
        </>
    )
}
