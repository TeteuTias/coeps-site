import { UserProvider } from '@auth0/nextjs-auth0/client';
//
//
export default function Layout({ children }) {
    //
    //
    console.log('att')
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
