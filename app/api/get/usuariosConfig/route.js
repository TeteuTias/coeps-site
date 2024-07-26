import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession,withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
// Reforma algumas informações do informacoes_usuarios 
//

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        // Verificando se está logado
        // Puxando configs
        const { db } = await connectToDatabase();
        const colecao = "usuarios"

        const { user } = await getSession();
        const userId = user.sub.replace("auth0|",""); // Retirando o auth0|  

        const result = await db.collection(colecao).find(
            {'_id':new ObjectId(userId)},
            {
                projection:{
                    '_id':0,
                    'informacoes_usuario':1,
                }
            }
        ).toArray()
        return NextResponse.json({ ...result[0].informacoes_usuario },{status:200});

    }
    catch (error) {
        // console.log(error)
        return NextResponse.json({ "error": error },{status:500})
    }
})
/*             

{"cpf":"71314066196","numero_telefone":"64999913746","nome":"Mateus Rosa Martins","email":"mateus2.0@icloud.com","data_criacao":"2024-07-15T21:29:04.116Z","titulo_honorario":""}


*/