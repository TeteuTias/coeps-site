import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.
        const { db } = await connectToDatabase();
        const colecao = 'trabalhos_blob'
        const query = userId === "66bbc8c2db29318201acc2a1" ? {} : { "userId": userId }
        const typeResponse = userId === "66bbc8c2db29318201acc2a1" ? "admin" : "user"

        const response = await db.collection(colecao).find(
            query,
            { projection: { "filename": 1, "_id": 1, "url": 1, userId:1 } }
        ).toArray() // 'buffer': 0, 'user_id': 0, 'size': 0

        // Gambiarra para manter formado
        const resposta = response.map(value => ({
            "_id": value['_id'],
            "name": value['filename'],
            "url": value['url'],
            "userId": `${value.userId}`,
        }))

        return NextResponse.json({
            "data": resposta,
            "type":typeResponse,
        }, { status: 200 });

    }
    catch (error) {
        return NextResponse.json({ "message": error }, { status: 500 })
    }
})
/*
{"data":[{"_id":"6696b5adf287f4a45ed8f04f","name":"Certificado.pdf"}]}
*/