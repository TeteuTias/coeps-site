import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 
const afterRefresh = (req, res, session) => {
    // Modificar a sessão conforme necessário
    session.user.customProperty = 'foo'; // Adiciona uma propriedade personalizada
    delete session.idToken; // Remove o idToken se não for necessário
    return session;
};


export async function GET(request, response) {
    try {
        const { accessToken } = await getAccessToken();

        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.
        const { db } = await connectToDatabase();
        const colecao = 'trabalhos'

        const response = await db.collection(colecao).find(
            {
                "user_id": userId
            },
            { projection: { 'buffer': 0, 'user_id': 0, 'size': 0 } }
        ).toArray()

        return NextResponse.json({
            "data": response
        }, { status: 200 });

    }
    catch (error) {
        return NextResponse.json({ "error": error }, { status: 500 })
    }
}
/*
{"data":[{"_id":"6696b5adf287f4a45ed8f04f","name":"Certificado.pdf"}]}
*/