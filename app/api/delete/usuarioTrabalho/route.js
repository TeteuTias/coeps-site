import { ObjectId } from 'mongodb';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { getSession,withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
//
//
//
//
//
export const POST = withApiAuthRequired(async function POST(request) {
    try {

        // Verificando se ele está logado
        // 
        const { accessToken } = await getAccessToken();
        //
        const { data_inicio_submissao, data_limite_submissao } = await getDatesFromDataBase()
        const verf = await verfSubmition(data_inicio_submissao, data_limite_submissao)
        //
        const { user } = await getSession();
        const data = await request.json()
        // Pegando id's
        const id_usuario = user.sub.replace("auth0|", "") // Retirando o auth0|  
        const id_trabalho = new ObjectId(data.id)
        //


        //
        // console.log(data.id)
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
})
//
const verfSubmition = async (data_inicio_submissao, data_limite_submissao) => {
    // Puxando data atual.
    const dataAtual = new Date()
    dataAtual.setHours(new Date().getHours() - 3)
    //
    const inicio = new Date(data_inicio_submissao);
    const limite = new Date(data_limite_submissao);
    // Verificando se x está entre inicio e limite
    if (dataAtual >= inicio && dataAtual <= limite) {
        //
        console.log("tudo ok :]")
    } else {
        throw { message: "Infelizmente, o prazo para a submissão de trabalhos já se encerrou. Portanto, você não pode mais apagar o arquivo.", status: 409 };
    }
}
// Função para buscar data_ de dp
const getDatesFromDataBase = async () => {
    const { db } = await connectToDatabase();
    const collection = 'trabalhos_config';

    const response = await db.collection(collection).find(
        {},
        {
            projection: {
                "_id": 0,
                "data_inicio_submissao": 1,
                "data_limite_submissao": 1
            }
        }
    ).toArray();
    return response[0];
};