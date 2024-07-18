// pages/api/upload.js
import { connectToDatabase } from '@/app/lib/mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
//
// Variáveis Globais
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
//
//
//
export const POST = withApiAuthRequired(async function POST(request) {

    try {
        const { user } = await getSession(request);
        const userId = user.sub.replace("auth0|", "");
        // Verificando se ainda dá tempo de enviar formulário.
        const { data_inicio_submissao, data_limite_submissao } = await getDatesFromDataBase()
        const verf = await verfSubmition(data_inicio_submissao, data_limite_submissao)
        // Pegando componentes de formulário
        const formData = await request.formData();
        const files = formData.getAll("file");

        // Validar o arquivo
        const file = validateFile(files);

        // Inserir o arquivo no banco de dados
        const insertedId = await insertFileIntoDatabase(file, userId);

        return Response.json({
            data: {
                name: file.name,
                user_id: userId,
                _id: insertedId,
            }
        }, { status: 200 });

    } catch (err) {
        // console.error(err);
        return Response.json({ error: err.message }, { status: err.status || 500 });
    }
});
// Função que verifica se a data atual ainda permite que o usuário submeta o trabalho dele.
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
    } else {
        throw { message: "Infelizmente, o prazo para a submissão de trabalhos já se encerrou.", status: 409 };
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

// Função para validar o arquivo
const validateFile = (files) => {
    if (files.length !== 1) {
        throw { message: "Envie apenas um arquivo.", status: 400 };
    }

    const file = files[0];
    if (file.size > MAX_FILE_SIZE) {
        throw { message: "O arquivo excede o limite máximo de 10MB por arquivo enviado.", status: 413 };
    }

    return file;
};

// Função para processar e inserir o arquivo no banco de dados
const insertFileIntoDatabase = async (file, userId) => {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { db } = await connectToDatabase();
    const collection = 'trabalhos';

    const response = await db.collection(collection).insertOne({
        name: file.name,
        size: file.size,
        user_id: userId,
        buffer,
    });

    return response.insertedId;
};