import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';


import { getSession } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'


export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {

        // Verificando se há sessão    
        // Puxando informações
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Puxando informações de DB
        const { db } = await connectToDatabase();
        const query = { "userId": new ObjectId(userId) }
        const result = await db.collection('certificadosAtividades').find(query).toArray()

        return NextResponse.json({ "data": result });

    }
    catch (error) {
        console.log(error)
        return NextResponse.json({ "error": error }, { status: 500 })
    }
})