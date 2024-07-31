import { connectToDatabase } from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';
//
// Exemplo de return:
//
//
// 

export const dynamic = 'force-dynamic'


export async function GET(request, { params }) {
    try {
        // Puxando configs
        const { db } = await connectToDatabase();
        const colecao = "organizadores"
        const result = await db.collection(colecao).find(
            {
                
            },
            {
                projection: {
                    "_id": 0,
                    "name": 1,
                    "imagesList": 1,
                }
            }
        ).toArray()
        return NextResponse.json(
            [ ...result ],
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