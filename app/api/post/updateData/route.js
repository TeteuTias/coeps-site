
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';

//
//
// Aqui ele sempre pega os mesmos parametros para realizar o update.
// assim, SEMPRE ENNVIE NESSE FORMATO: {cpf, numero_telefone, nome}
export const POST = withApiAuthRequired(async function POST(request) {
    try {
        // Verificando se está logado

        // Puxando informações
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  

        if (!userId) {
            return Response.json({ "erro": "!userId" })
        }

        const ASAAS_API_KEY = process.env.ASAAS_API_KEY //process.env.ASAAS_API_KEY
        const ASAAS_API_URL = process.env.ASAAS_API_URL + "/customers"

        const data = await request.json()

        const { db } = await connectToDatabase();
        const b = new ObjectId(userId)
        //
        //
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                'name': str(data.nome),
                'email': str(user.email),
                'cpfCnpj': str(data.cpf),
                'mobilePhone': str(data.numero_telefone),
                'observations': str(userId),
                'notificationDisabled': true,
            })
        }
        //
        var id_api = ""
        const response = await fetch("https://asaas.com/api/v3/customers", options)
        var responseJson = await response.json()
        if (!response.ok) {
            throw ({ "message": responseJson })
        }
        id_api = responseJson.id
        //
        //
        //

        //  "isPos_registration": 0 - tava na query
        await db.collection('usuarios').findOneAndUpdate({ "_id": b }, {
            "$set": {
                id_api,
                'isPos_registration': 1,
                'informacoes_usuario.nome': data.nome,
                'informacoes_usuario.cpf': data.cpf,
                'informacoes_usuario.numero_telefone': data.numero_telefone,
            }
        })


        return Response.json({ "sucesso": "Ocorreu Tudo Certo!" })
        /**
         'isPos_registration':1, // Sempre colocar 1 para ele nao voltar ai de novo
            'nome': data.nome,
            'numero_telefone': data.numero_telefone,
            'cpf': data.cpf
            
            */
    }
    catch (error) {
        return Response.json({ "erro": error }, { status: 500 })
    }


})