import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0-compat';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth0-compat';
import { withApiAuthRequired } from '@/lib/auth0-compat';
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
/** @type {any} */
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
            { projection: { 'informacoes_usuario': 1, 'pagamento.situacao_animacao':1,'pagamento.situacao': 1, 'isPos_registration': 1, '_id': 0 } }
        ).toArray()

        return NextResponse.json({
            ...response[0]
        }, { status: 200 });

    }
    catch {
        return NextResponse.json(
            { error: "internal_server_error", message: "Não foi possível verificar o usuário." },
            { status: 500 }
        )
    }
})

/*
{ isPos_registration: 1, pagamento: { situacao: 0 } }
*/
