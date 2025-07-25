import { connectToDatabase } from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'


export async function GET(request, { params }) {
    try {
        // Puxando configs
        const { db } = await connectToDatabase();
        const colecao1 = "palestras"
        const colecao2 = "minicursos"
        const [result1, result2] = await Promise.all([
            db.collection(colecao1).find(
                {},

            ).toArray(),
            db.collection(colecao2).find(

            ).toArray(),
        ]);
        // result 1 == ICourse
        // result 2 == ILecture
        return NextResponse.json(
            { result1, result2 },
            {
                headers: {
                    'Cache-Control': 'no-cache',
                }
            }
        )

    }
    catch (error) {
        //console.log(error)
        return NextResponse.json({ "error": error }, { status: 500 })
    }
}
/*             { projection: { _id: 0 } }
    {
    "data_inicio_submissao": "2024-07-14T00:00:00-03:00",
    "data_limite_submissao": "2024-10-14T18:30:00-03:00",
    "data_publicacao_resultados": "2024-10-20T18:30:00-03:00",
    "autores_por_trabalho": "",
    "trabalhos_por_usuario": 2
    }
*/