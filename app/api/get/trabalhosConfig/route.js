import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
import { getSession,withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 
export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        // Verificando se está logado
        const { accessToken } = await getAccessToken();
        // Puxando configs
        const { db } = await connectToDatabase();
        const colecao = "trabalhos_config"
        const result = await db.collection(colecao).find(
            {},

        ).toArray()
        return NextResponse.json({ ...result[0] });

    }
    catch (error) {
        //console.log(error)
        return NextResponse.json({ "error": error })
    }
})
/*             { projection: { _id: 0 } }
    {
    "data_inicio_submissao": "2024-07-14T00:00:00-03:00",
    "data_limite_submissao": "2024-10-14T18:30:00-03:00",
    "data_publicacao_resultados": "2024-10-20T18:30:00-03:00",
    "autores_por_trabalho": "",
    "trabalhos_por_usuario": 2
    }
*/