import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth0-compat';
import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
//
//
// Reforma algumas informações do informacoes_usuarios 
//

export const dynamic = 'force-dynamic'

/** @type {any} */
export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        // Verificando se está logado
        // Puxando configs
        const { db } = await connectToDatabase();
        const colecao = "usuarios"

        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  

        const result = await db.collection(colecao).find(
            { '_id': new ObjectId(userId) },
            {
                projection: {
                    '_id': 0,
                    'informacoes_usuario': 1,
                }
            }
        ).toArray()
        if (!result[0]?.informacoes_usuario) {
            return NextResponse.json(
                { error: "not_found", message: "As informações do usuário não foram encontradas." },
                { status: 404 }
            );
        }
        return NextResponse.json({ ...result[0].informacoes_usuario }, { status: 200 });
        // result[0].informacoes_usuario => IUser['informacoes_usuario']

    }
    catch {
        return NextResponse.json(
            { error: "internal_server_error", message: "Não foi possível consultar as informações do usuário." },
            { status: 500 }
        )
    }
})
/*             

{"cpf":"71314066196","numero_telefone":"64999913746","nome":"Mateus Rosa Martins","email":"mateus2.0@icloud.com","data_criacao":"2024-07-15T21:29:04.116Z","titulo_honorario":""}


*/
