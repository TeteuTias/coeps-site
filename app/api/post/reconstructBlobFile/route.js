import { put, del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';

// 5 minutos

export const POST = withApiAuthRequired(async function POST(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace("auth0|", "");

    try {
        const body = await request.json();
        const { chunkFileName, finalFileName, chunkIds, totalSize } = body;

        if (!chunkFileName || !finalFileName || !chunkIds || !Array.isArray(chunkIds) || !totalSize) {
            return NextResponse.json({ error: 'Dados para reconstrução incompletos' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        const existingFile = await db.collection('trabalhos_blob').findOne({ userId: userId, filename: finalFileName });
        if (existingFile) {
            return NextResponse.json({ error: `Arquivo "${finalFileName}" já existe.` }, { status: 409 });
        }

        const chunks = await db.collection('trabalhos_chunks').find({
            chunkId: { $in: chunkIds },
            userId: userId,
            fileName: chunkFileName
        }).sort({ chunkIndex: 1 }).toArray();

        if (chunks.length !== chunkIds.length) {
            return NextResponse.json({ error: 'Alguns chunks não foram encontrados ou não pertencem ao usuário.' }, { status: 400 });
        }

        const chunkBuffers = await Promise.all(chunks.map(async (chunk) => {
            const response = await fetch(chunk.url);
            if (!response.ok) throw new Error(`Erro ao baixar o chunk ${chunk.chunkIndex}`);
            return Buffer.from(await response.arrayBuffer());
        }));
        const reconstructedFile = Buffer.concat(chunkBuffers);

        if (reconstructedFile.length !== totalSize) {
            return NextResponse.json({ error: 'Tamanho do arquivo reconstruído não confere.' }, { status: 500 });
        }

        const finalBlob = await put(`${userId}/trabalhos/${finalFileName}`, reconstructedFile, { access: 'public' });

        const fileInfo = {
            pathname: finalBlob.pathname,
            filename: finalFileName,
            url: finalBlob.url,
            userId: userId,
            uploadDate: new Date(),
            size: totalSize,
            chunked: true,
            chunkIds: chunkIds
        };
        const result = await db.collection('trabalhos_blob').insertOne(fileInfo);

        const chunkUrlsToDelete = chunks.map(c => c.url);
        await del(chunkUrlsToDelete);
        await db.collection('trabalhos_chunks').deleteMany({ chunkId: { $in: chunkIds } });

        return NextResponse.json({
            success: true,
            data: {
                _id: result.insertedId.toString(),
                name: finalFileName,
                url: finalBlob.url,
                pathname: finalBlob.pathname,
                user_id: userId,
                size: totalSize,
                uploadDate: fileInfo.uploadDate.toISOString(),
            }
        });

    } catch (error) {
        console.error('Erro na reconstrução do arquivo:', error);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
    }
});
