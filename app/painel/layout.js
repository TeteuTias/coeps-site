'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import TelaLoading from "../components/TelaLoading";
import PaginaErrorPadrao from "../components/PaginaErrorPadrao";
//
import HeaderPainel from "../components/HeaderPainel";
//
//
export default function Layout({ children }) {
    //
    //
    return (
        <>
        <HeaderPainel />
        <div className="min-h-screen">
            {children}
        </div>
        </>
    )
}