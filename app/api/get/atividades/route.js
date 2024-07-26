import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
  try {
    // Verificando se está logado
    // Puxando configs

    const { db } = await connectToDatabase();
    const colecao = "minicursos"
    const result = await db.collection(colecao).find(
      {},

    ).toArray()

    const { user } = await getSession();
    const _id = user.sub.replace("auth0|", ""); // Retirando o auth0|  

    const userRegistrationsCount = await db.collection(colecao).countDocuments({
      participants: _id
    });
    const alreadIinscrivy = 3 - userRegistrationsCount > 0 ? 3 - userRegistrationsCount : 0


    return NextResponse.json({ _id, listEvents: result, alreadIinscrivy:alreadIinscrivy}, { status: 200 });

  }
  catch (error) {
    //console.log(error)
    return NextResponse.json({ "message": error }, { status: 500 })
  }
})
/* {
         
  _id:id   
  listEvents: [
    {
      "_id": "66934efb29c777824717507b",
      "name": "Terapia Hormonal de Reposição de Testosterona",
      "description": "Palestra sobre testo e como usar",
      "maxParticipants": 40,
      "participantsCount": 0,
      "participants": [
        "6692c5208072c6037885c94d",
        "669b0e73f89da1fa30deb6ee",
        "669b112fa2a21905b47571a7"
      ],
      "isFree": 1,
      "timeline": [
        {
          "_id": "66934efb29c777824717507b",
          "name": "Palestra sobre HBP",
          "date_init": "2024-07-18T13:00:00-03:00",
          "date_end": "2024-07-18T15:30:00-03:00",
          "description": "Palestra sobre HBP com o Dr. Humberto de Morais. Vamos abrodar o tema profundamente...",
          "speakers": [],
          "presence_list": [],
          "local_description": "Não se atrase",
          "local": "Pegaremos um ônibus em frente a IMEPAC.",
          "_idPattern": "66934efb29c777824717507b"
        }
      ],
      "isOpen": 1,
      "dateOpen": "2024-07-18T13:00:00-03:00",
      "type": "teste3",
      "organization_name": "UROLIGA"
    },
    {
      "_id": "669c743fc07af596f70fb7ac",
      "name": "Terapia Hormonal de Reposição de Testosterona",
      "description": "Palestra sobre testo e como usar",
      "maxParticipants": 40,
      "participantsCount": 0,
      "participants": [
        "6692c5208072c6037885c94d",
        "669b112fa2a21905b47571a7"
      ],
      "isFree": 1,
      "timeline": [
        {
          "_id": "66934efb29c777824717507b",
          "name": "Início",
          "date_init": "2024-07-18T13:00:00-03:00",
          "date_end": "2024-07-18T15:30:00-03:00",
          "description": "Curso Teórico Prático",
          "speakers": [],
          "presence_list": [],
          "local_description": "Ao lado do ambulatório",
          "local": "Centro de Simulação Realística",
          "_idPattern": "669c743fc07af596f70fb7ac"
        }
      ],
      "isOpen": 1,
      "dateOpen": "2024-07-18T13:00:00-03:00",
      "type": "teste4",
      "organization_name": "UROLIGA"
    }
  ]
}
*/