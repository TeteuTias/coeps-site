// pages/api/download.js
import { ObjectId, GridFSBucket } from 'mongodb';
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
  try {
    const { user } = await getSession();
    const idComponente = params["_id"];

    if (!ObjectId.isValid(idComponente)) {
      return new Response(JSON.stringify({ message: "Não foi possível encontrar o arquivo. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { db } = await connectToDatabase();

    const data = await db.collection('certificadosAtividades').find({
      _id: new ObjectId(idComponente)
    }).toArray()

    if (data.length != 1) {
      return new Response(JSON.stringify({ message: "Não foi possível encontrar seu certificado. [ERROR: length != 1]." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const fileId = data[0].certificateId

    const bucket = new GridFSBucket(db, { bucketName: 'certificadosAtividades' });

    // Verifique se o arquivo pertence ao usuário
    const file = await db.collection('certificadosAtividades.files').findOne({ _id: new ObjectId(fileId) });

    if (!file) {
      console.log(fileId)
      return new Response(JSON.stringify({ message: "Arquivo não encontrado ou você não tem permissão para baixá-lo." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Criar o fluxo de leitura do arquivo a partir do GridFS
    const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

    // Definir os cabeçalhos da resposta para o download
    const headers = {
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`
    };

    // Criar a resposta com o stream e os cabeçalhos
    return new Response(downloadStream, { headers, status: 200 });

  } catch (error) {
    console.log(error.message);
    return new Response(JSON.stringify({ message: error.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
