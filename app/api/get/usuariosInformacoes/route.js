import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 


export const dynamic = 'force-dynamic'

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
            { projection: { "informacoes_usuario": 1,"isPos_registration":1, _id: 0,"pagamento.situacao":1 } }
        ).toArray()
        return NextResponse.json({ "data": result[0] });

    }
    catch (error){
        return NextResponse.json({"error": error})
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