import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

/*
export const GET = withApiAuthRequired( async function GET(request, response) {
    
    return Response.request({"ola":"mund"})
});
  */
export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        //
        const { user } = await getSession();
        //
        //
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        //
        // Já vem apenas com o replace.
        const { db } = await connectToDatabase();
        const colecao = 'usuarios'

        const response = await db.collection(colecao).find(
            {
                "_id": new ObjectId(userId)
            },
            { projection: { 'pagamento.situacao_animacao':1,'pagamento.situacao': 1, 'isPos_registration': 1, '_id': 0 } }
        ).toArray()

        return NextResponse.json({
            ...response[0]
        }, { status: 200 });

    }
    catch (error) {
        //console.log(error)
        return NextResponse.json({ "error": error }, { status: 500 })
    }
})

/*
{ isPos_registration: 1, pagamento: { situacao: 0 } }
*/