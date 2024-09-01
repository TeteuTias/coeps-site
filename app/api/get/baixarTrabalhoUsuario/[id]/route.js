// pages/api/download.js
import { ObjectId, GridFSBucket } from 'mongodb';
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';


export const GET = withApiAuthRequired(async function GET(request, { params }) {
  try {
    const { user } = await getSession();
    //const { searchParams } = new URL(request.url);

    const fileId = params["id"];

    if (!ObjectId.isValid(fileId)) {
      return Response.json({ message: "Não foi possível encontrar o arquivo. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const bucket = new GridFSBucket(db, { bucketName: 'trabalhos' });

    // Verifique se o arquivo pertence ao usuário
    const file = await db.collection('trabalhos.files').findOne({ _id: new ObjectId(fileId), "metadata.user_id": user.sub.replace("auth0|", "") });

    if (!file) {
      return Response.json({ message: "Arquivo não encontrado ou você não tem permissão para baixá-lo." }, { status: 404 });
    }

    // Criar o fluxo de leitura do arquivo a partir do GridFS
    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

    // Definir os cabeçalhos da resposta para o download
    const headers = new Headers();
    headers.append('Content-Type', file.contentType || 'application/octet-stream');
    headers.append('Content-Disposition', `attachment; filename="${file.filename}"`);

    return new Response(downloadStream, { headers, status: 200 });

  } catch (error) {
    console.log(error.message)
    return Response.json({ message: error.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }, { status: 500 });
  }
});
