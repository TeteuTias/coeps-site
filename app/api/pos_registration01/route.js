import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../lib/mongodb'
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
//Nome webwook -> pos_registration01
/**
 * É responsável por criar o "esqueleto do usuário no DB. é execudado sempre que um novo usuário é criado a mandado do Auth0.
 * Se ele não criar o esqueleto, não há como continuar na conta.
 */

// https://sandbox.asaas.com/api/v3/customers
export const POST = withApiAuthRequired (async function POST(request) {


    const { searchParams } = new URL(request.url)
    const requestData = await request.json() 
    const email = requestData.usuario_email;
    const nome  = requestData.usuario_nome;
    const user_id = requestData.usuario_id.replace("auth0|","");
    const data_criacao = new Date() // ele manda a data criação mas eu nao estou usando.


    try {
        const { db } = await connectToDatabase();

        const result = await db.collection('usuarios').insertOne({
            "_id":new ObjectId(user_id),
            "id_api":"",
            "isPos_registration":0,
            "informacoes_usuario":{
                "cpf":"",
                "numero_telefone":"",
                "nome":"",
                "email":email,
                "data_criacao":data_criacao,
                "titulo_honorario":""
            },
            "pagamento":{
                "situacao":0,// O zero sinaliza que ainda não há pagamento aprovado.
                "lista_pagamentos":[]
            }
            
        });
        return Response.json({ "sucesso":"Ocorreu tudo certo" })
    }
    catch (error) {
        return Response.json({"erro":error})
    }
})