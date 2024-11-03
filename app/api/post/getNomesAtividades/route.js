
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

        const data = await request.json()

        const objectIds = data.certificateIdsList
            .filter(id => id !== null) // Remove valores `null` da lista
            .map(id => new ObjectId(id)); // Converte IDs válidos para ObjectId

        const { db } = await connectToDatabase();
        const resultQuery = await db.collection("minicursos").find({ _id: { $in: objectIds } }, { projection: { name: 1 } })
            .toArray()

        // Transformação da lista no formato desejado
        const transformedObject = resultQuery.reduce((acc, item) => {
            // Converte o `_id` para string e usa como chave, com `name` como valor
            acc[item._id.toString()] = item.name;
            return acc;
        }, {});

        return Response.json({ "data": transformedObject })



        const b = new ObjectId(userId)


        var responseJson = await response.json()


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
    }
    catch (error) {
        return Response.json({ "message": error.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }, { status: 500 })
    }


})