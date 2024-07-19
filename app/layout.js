
// app/layout.jsx
import { UserProvider } from '@auth0/nextjs-auth0/client';
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
      <UserProvider>
        <body className="">
          {children}
        </body>
      </UserProvider>
    </html>
  )
}

