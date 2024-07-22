
// app/layout.jsx

import "./globals.css";
//
//
export const metadata = {
  title: 'COEPS',
  description: 'Bem-Vindo(a) ao site oficial do COEPS',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      
        <body className="">
          {children}
        </body>
      
    </html>
  )
}
/*
<UserProvider>
</UserProvider>
import { UserProvider } from '@auth0/nextjs-auth0/client';

*/

