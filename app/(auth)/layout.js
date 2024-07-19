'use client'
import { useRouter } from 'next/router';
import { Children } from 'react';
import HeaderPainel from '../components/HeaderPainel';
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
