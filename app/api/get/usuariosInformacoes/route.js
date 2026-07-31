import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0-compat';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 


export const dynamic = 'force-dynamic'

/** @type {any} */
export const GET = withApiAuthRequired((async function GET( request, { params } ) {
    try{
        // Verificando se está logado
        // Puxando informações
        
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|",""); // Retirando o auth0|  

        //
        // Já vem apenas com o replace.
        const { db } = await connectToDatabase();
        const result = await db.collection('usuarios').find(
            {"_id":new ObjectId(userId) },
            { projection: { "informacoes_usuario": 1,"isPos_registration":1, _id: 1,"pagamento.situacao":1 } }
        ).toArray()
        return NextResponse.json({ "data": result[0] });

    }
    catch {
        return NextResponse.json(
            { error: "internal_server_error", message: "Não foi possível consultar as informações do usuário." },
            { status: 500 }
        )
    }
}))
/*
    try {
        const { db } = await connectToDatabase();
        
        const result = await db.collection('usuarios').find({}).toArray()
        
        return Response.json({ "Olá":result})
    }
    catch (error) {
        return Response.json({"Algo deu errado":error})
    }
*/
