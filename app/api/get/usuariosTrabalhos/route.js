import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@/lib/auth0-compat';
import { ObjectId } from 'bson';
import { getSession } from '@/lib/auth0-compat';
import { runPaymentTransaction } from '@/lib/payments/transactions';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

/** @type {any} */
export const GET = withApiAuthRequired(async function GET(request, response) {
    try {
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.
        const { db, client } = await connectToDatabase();
        // Uma única visão evita mostrar o trabalho ativo junto de sua limpeza
        // pendente quando a exclusão é confirmada entre as duas consultas.
        const result = await runPaymentTransaction(client, async (session) => {
            const data = await db.collection('Dados_do_trabalho').find(
                { userId: new ObjectId(userId) }, { session },
            ).toArray();
            const pendingDeletions = await db.collection('trabalhos_exclusoes').find(
                { userId: new ObjectId(userId), status: 'PENDING' },
                { session, projection: { _id: 1, titulo: 1 } },
            ).toArray();
            return { data, pendingDeletions };
        });

        return NextResponse.json({
            ...result,
        });
        /*
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
        */

    }
    catch {
        return NextResponse.json(
            { error: "internal_server_error", message: "Não foi possível consultar os trabalhos." },
            { status: 500 }
        )
    }
})
/*
{"data":[{"_id":"6696b5adf287f4a45ed8f04f","name":"Certificado.pdf"}]}
*/
