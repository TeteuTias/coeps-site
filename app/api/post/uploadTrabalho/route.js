// pages/api/upload.js
import { GridFSBucket } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';

export const runtime = 'nodejs'; // Mude para 'nodejs' para evitar o Edge Runtime

// Variáveis Globais
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const { user } = await getSession(request);
        const userId = user.sub.replace("auth0|", "");

        // Verificando se ainda dá tempo de enviar o formulário.
        const { data_inicio_submissao, data_limite_submissao } = await getDatesFromDataBase();
        await verfSubmition(data_inicio_submissao, data_limite_submissao);

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
        console.error(err);
        return Response.json({ message: err.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS."}, { status: err.status || 500 });
    }
});

// Função que verifica se a data atual ainda permite que o usuário submeta o trabalho dele.
const verfSubmition = async (data_inicio_submissao, data_limite_submissao) => {
    const dataAtual = new Date();
    dataAtual.setHours(dataAtual.getHours() - 3);

    const inicio = new Date(data_inicio_submissao);
    const limite = new Date(data_limite_submissao);

    if (!(dataAtual >= inicio && dataAtual <= limite)) {
        throw { message: "Infelizmente, o prazo para a submissão de trabalhos já se encerrou.", status: 409 };
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

// Função para validar o arquivo
const validateFile = (files) => {
    if (files.length !== 1) {
        throw { message: "Envie apenas um arquivo.", status: 400 };
    }

    const file = files[0];
    if (file.size > MAX_FILE_SIZE) {
        throw { message: "O arquivo excede o limite máximo de 100MB por arquivo enviado.", status: 413 };
    }

    return file;
};

// Função para inserir o arquivo no banco de dados
const insertFileIntoDatabase = async (file, userId) => {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { db } = await connectToDatabase();

    const bucket = new GridFSBucket(db, { bucketName: 'trabalhos' });

    const uploadStream = bucket.openUploadStream(file.name, {
        metadata: {
            user_id: userId,
            size: file.size,
        }
    });

    uploadStream.end(buffer);

    return new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
            resolve(uploadStream.id);
        });

        uploadStream.on('error', (err) => {
            reject(err);
        });
    });
};