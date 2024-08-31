
import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
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
            return Response.json({ "message": "!userId" }, {status:500})
        }


        const { db } = await connectToDatabase();
        const b = new ObjectId(userId)
        //
        //

        //  "isPos_registration": 0 - tava na query
        await db.collection('usuarios').findOneAndUpdate({ "_id": b }, {
            "$set": {
                "pagamento.situacao_animacao":1
            }
        })


        return Response.json({ "message": "Ocorreu Tudo Certo!" },{status:200})
    }
    catch (error) {
        console.log(error)
        return Response.json({ "message": error.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }, { status: 500 })
    }


})