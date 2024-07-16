import { ObjectId } from 'mongodb';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
//
//
//
//
//
export async function POST(request) {
    try {

        // Verificando se ele está logado
        // 
        const { accessToken } = await getAccessToken();
        const { user } = await getSession();
        const data = await request.json()
        // Pegando id's
        const id_usuario = user.sub.replace("auth0|", "") // Retirando o auth0|  
        const id_trabalho = new ObjectId(data.id)


        //
        //
        // Puxando id_api.
        const { db } = await connectToDatabase()
        const collection = 'trabalhos'
        var query = {
            "_id": id_trabalho,
            "user_id": id_usuario
        }
        const result = await db.collection(collection).deleteOne(query)
        // Verificando se foi deletado
        if (result.acknowledged == false) {
            console.log('result.acknowledged')
            return Response.json({ "erro": 'result.acknowledged == false' }, { status: 400 })
        }
        else if (result.deletedCount == 0) {
            console.log("result.deletedCount")
            return Response.json({ "erro": 'result.deletedCount == 0' }, { status: 400 })
        }
        //
        //
        // Se tudo der certo retorne sucesso!
        return Response.json({ "message": 'sucesso' }, { status: 200 })
    }
    catch (error) {
        console.log(error)
        return Response.json({ "erro": error }, { status: 403 })
    }
}
//