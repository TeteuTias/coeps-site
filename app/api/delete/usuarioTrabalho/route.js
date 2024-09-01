import { ObjectId, GridFSBucket } from 'mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        // Verificando se o usuário está logado e as datas de submissão
        const { data_inicio_submissao, data_limite_submissao } = await getDatesFromDataBase();
        const verf = await verfSubmition(data_inicio_submissao, data_limite_submissao);

        const { user } = await getSession();
        const data = await request.json();

        // Pegando IDs
        const id_usuario = user.sub.replace("auth0|", ""); // Retirando o auth0|
        const id_trabalho = new ObjectId(data.id);

        // Conectando ao banco de dados e ao GridFS
        const { db } = await connectToDatabase();
        const bucket = new GridFSBucket(db, { bucketName: 'trabalhos' });

        // Verificando se o arquivo pertence ao usuário
        const file = await db.collection('trabalhos.files').findOne({ _id: id_trabalho, "metadata.user_id": id_usuario });

        if (!file) {
            return Response.json({ error: "O arquivo não foi encontrado ou você não tem permissão para excluí-lo." }, { status: 404 });
        }

        // Apagando o arquivo (incluindo seus chunks) do GridFS
        await bucket.delete(id_trabalho);

        // Se tudo der certo, retorne sucesso
        return Response.json({ message: 'O arquivo foi excluído com sucesso!' }, { status: 200 });
    } catch (error) {
        //console.log(error);
        return Response.json({ message: error.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o problema persista, entre em contato com a equipe COEPS" }, { status: error.status || 403 });
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
