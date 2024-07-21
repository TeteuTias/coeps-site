'use client'
import HeaderPainel from '@/app/components/HeaderPainel';
import Twemoji from 'react-twemoji';
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
            <Twemoji options={{ className: 'twemoji' }}>
                <div className="min-h-screen">
                    <HeaderPainel />
                    {children}
                </div>
            </Twemoji>
        </>
    )
}
