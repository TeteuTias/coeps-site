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

// GUANBIARRA DAS BRABASSSSSS
// POR ENQUANTO ELE PUXA SÓ O 66bcfceedc9c7250e85b2ac6
// SE PRECISAR DEPOIS ELE PUXA O RESTANTE BASEADO NA DATA E SEI LÁ O QUE MAIS.

export const GET = withApiAuthRequired(async function GET(request, { params }) {
  try {
    // Verificando se está logado
    // Puxando configs

    const { db } = await connectToDatabase();
    const colecao = "ingressos_config"
    const result = await db.collection(colecao).find(
      {_id: new ObjectId("66bcfceedc9c7250e85b2ac6")},
    ).toArray() 

    /*
        const userRegistrationsCount = await db.collection(colecao).countDocuments({
          participants: _id
        });
        const alreadIinscrivy = 3 - userRegistrationsCount > 0 ? 3 - userRegistrationsCount : 0
    */

    return NextResponse.json({ ...result[0] }, { status: 200 });
    // result[0] => IPaymentConfig

  }
  catch (error) {
    console.log(error)
    return NextResponse.json({ "message": error }, { status: 500 })
  }
})
