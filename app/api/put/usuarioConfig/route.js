import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb'
import { getAccessToken, getSession } from '@auth0/nextjs-auth0';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
//
//
//
export const PUT = withApiAuthRequired(async function (request) {



    try {
        //

        const { accessToken } = await getAccessToken();
        const { user } = await getSession();
        const _id = new ObjectId(user.sub.replace("auth0|", "")) // Retirando o auth0|  
        //
        const value = await request.json()
        //
        switch (true) {
            case value.nome != undefined:
                return updateOnDb({ "informacoes_usuario.nome": value.nome }, _id)
            case value.email != undefined:
                return updateOnDb({ "informacoes_usuario.email": value.email }, _id)
            case value.cpf != undefined:
                return updateOnDb({ "informacoes_usuario.cpf": value.cpf }, _id)
            case value.numero_telefone != undefined:
                return updateOnDb({ "informacoes_usuario.numero_telefone": value.numero_telefone }, _id) 
        }

        throw new Error('!Case')
    }
    catch (error) {
        //console.log('errorrrrrrrrrr')
        return Response.json({ "error": error }, { status: 500 })
    }
})
const updateOnDb = async (update, _id) => {
    // update -> {campo_a_ser_atualizado: atualizacao}
    //
    const { db } = await connectToDatabase();
    const result = await db.collection('usuarios').updateOne(
        { _id },
        { $set: update }
    );
    return Response.json({ "message": "Atualização feita com sucesso!" }, { status: 200 })

    //
    //
}