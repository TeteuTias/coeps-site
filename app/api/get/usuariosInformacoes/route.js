import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 
export async function GET( request, { params } ) {
    try{

        const { accessToken } = await getAccessToken();
        
        const response = await fetch('https://dev-kj0gfrsdev5h0hkl.us.auth0.com/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        //console.log(response)
        const userData = await response.json();
        const userId = userData.sub.replace("auth0|",""); // Retirando o auth0|
        //
        // console.log('Dados do usuário:', userId.replace("auth0|",""));
        //
        //
        //
        // Já vem apenas com o replace.
        const { db } = await connectToDatabase();
        const result = await db.collection('usuarios').find(
            {"_id":new ObjectId(userId) },
            { projection: { "informacoes_usuario": 1,"isPos_registration":1, _id: 0 } }
        ).toArray()
        return NextResponse.json({ "data": result[0] });

    }
    catch (error){
        return NextResponse.json({"error": error})
    }
}
/*
    try {
        const { db } = await connectToDatabase();
        
        const result = await db.collection('usuarios').find({}).toArray()
        
        return Response.json({ "Olá":result})
    }
    catch (error) {
        return Response.json({"Algo deu errado":error})
    }
*/