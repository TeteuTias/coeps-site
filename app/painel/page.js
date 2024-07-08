'use client'
import { useUser } from "@auth0/nextjs-auth0/client"
import Link from "next/link";
import { useRouter } from 'next/navigation';
//
//
//
export default () =>{
    const { user, error, isLoading } = useUser();
    const router = useRouter()

    if (isLoading) {
        return <h1 className="bg-yellow-700">Carregando</h1>
    }
    if (!user) {
        router.push('/')
        return <></>
    }
    return(
        <>
            <h1 className="text-black">{user?"Voce está logado":"Voce não está logado"}</h1>
            <div className="bg-yellow-300">
                <Link href="/api/auth/logout"><h1>LogOut</h1></Link>
            </div>
            <button className="bg-yellow-500 p-10" onClick={()=>{console.log(user["email"])}}>X</button>
        </>
    )
}