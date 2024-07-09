
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
//
//
// Aqui ele sempre pega os mesmos parametros para realizar o update.
// assim, SEMPRE ENNVIE NESSE FORMATO: {cpf, numero_telefone, nome}
export async function POST(request) {
    try {
        
        const { accessToken } = await getAccessToken();
        
        
    const response = await fetch('https://dev-kj0gfrsdev5h0hkl.us.auth0.com/userinfo', {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    const userData = await response.json();
    const userId = userData.sub.replace("auth0|",""); // Retirando o auth0|
    if (!userId) {
        return Response.json({"erro":"!userId"})
    }
    const data = await request.json()
    
    const { db } = await connectToDatabase();
    const b = new ObjectId(userId)
    /*
    await db.collection('usuarios').findOneAndUpdate({"_id":b}, {"$set":{
        'informacoes_usuario.nome':data.nome,
        
        
        }})
        */
       await db.collection('usuarios').findOneAndUpdate({"_id":b}, {"$set":{
           'isPos_registration':1,
           'informacoes_usuario.nome':data.nome,
           'informacoes_usuario.cpf':data.cpf,
           'informacoes_usuario.numero_telefone':data.numero_telefone,
        }})
        
        return Response.json({ "sucesso":"Ocorreu Tudo Certo!" })
        /**
         'isPos_registration':1, // Sempre colocar 1 para ele nao voltar ai de novo
         'nome': data.nome,
         'numero_telefone': data.numero_telefone,
         'cpf': data.cpf
         
         */
    }
    catch (error){
        return Response.json({ "erro":error })
    }   


}