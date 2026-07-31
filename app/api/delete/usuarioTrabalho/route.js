import { ObjectId, GridFSBucket } from 'mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/app/lib/mongodb';
import { del } from '@vercel/blob';


/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    try {
        // Verificando se o usuário está logado e as datas de submissão
        const { data_inicio_submissao, data_limite_submissao } = await getDatesFromDataBase();
        const verf = await verfSubmition(data_inicio_submissao, data_limite_submissao);

        const { user } = await getSession();
        const data = await request.json();

        // Pegando IDs
        const id_usuario = user.sub.replace("auth0|", ""); // Retirando o auth0|
        const urlBlob = data.id;

        // Conectando ao banco de dados e ao GridFS
        const { db } = await connectToDatabase();
        // const bucket = new GridFSBucket(db, { bucketName: 'trabalhos' });

        // Verificando se o arquivo pertence ao usuário
        const file = await db.collection('trabalhos_blob').findOne({ url: urlBlob, "userId": id_usuario });

        if (!file) {
            return Response.json({ error: "O arquivo não foi encontrado ou você não tem permissão para excluí-lo." }, { status: 404 });
        }

        await del(urlBlob)
        await db.collection('trabalhos_blob').deleteOne({ url: urlBlob, "userId": id_usuario });


        // Apagando o arquivo (incluindo seus chunks) do GridFS
        // await bucket.delete(id_trabalho);

        // Se tudo der certo, retorne sucesso
        return Response.json({ message: 'O arquivo foi excluído com sucesso!' }, { status: 200 });
    } catch (error) {
        if (error?.status === 409) {
            return Response.json(
                { error: "submission_closed", message: "O prazo para excluir arquivos já foi encerrado." },
                { status: 409 }
            );
        }
        return Response.json(
            { error: "internal_server_error", message: "Não foi possível excluir o arquivo." },
            { status: 500 }
        );
    }
});

// Função para verificar as datas de submissão
const verfSubmition = async (data_inicio_submissao, data_limite_submissao) => {
    const dataAtual = new Date();
    dataAtual.setHours(new Date().getHours() - 3);

    const inicio = new Date(data_inicio_submissao);
    const limite = new Date(data_limite_submissao);

    if (dataAtual >= inicio && dataAtual <= limite) {
        //console.log("Tudo ok :)");
    } else {
        throw { message: "Infelizmente, o prazo para a submissão de trabalhos já se encerrou. Portanto, você não pode mais apagar o arquivo.", status: 409 };
    }
};

// Função para buscar as datas de submissão no banco de dados
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
