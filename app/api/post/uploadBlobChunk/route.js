import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';

// 👇 **CORREÇÃO: Mudar o runtime para 'edge'**
 // 60 segundos

const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB por chunk

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const { user } = await getSession(request);
        const userId = user.sub.replace("auth0|", "");

        const formData = await request.formData();
        const chunk = formData.get('chunk');
        const chunkIndexStr = formData.get('chunkIndex');
        const totalChunksStr = formData.get('totalChunks');
        const fileName = formData.get('fileName');

        if (!chunk || chunkIndexStr === null || totalChunksStr === null || !fileName) {
            return NextResponse.json({ error: 'Dados do chunk incompletos' }, { status: 400 });
        }

        const chunkIndex = parseInt(chunkIndexStr, 10);
        const totalChunks = parseInt(totalChunksStr, 10);

        if (chunk.size > MAX_CHUNK_SIZE) {
            return NextResponse.json({ error: 'Chunk excede o limite máximo de 10MB' }, { status: 413 });
        }

        const chunkId = `${userId}_${fileName}_chunk_${chunkIndex}_${Date.now()}`;
        const blob = await put(`${userId}/chunks/${chunkId}`, chunk, {
            access: 'public',
        });

        const { db } = await connectToDatabase();
        const result = await db.collection('trabalhos_chunks').insertOne({
            chunkId: chunkId,
            pathname: blob.pathname,
            url: blob.url,
            userId: userId,
            fileName: fileName,
            chunkIndex: chunkIndex,
            totalChunks: totalChunks,
            size: chunk.size,
            uploadDate: new Date()
        });

        return NextResponse.json({
            chunkId: chunkId,
            chunkIndex: chunkIndex,
            _id: result.insertedId.toString()
        });

    } catch (error) {
        console.error('Erro no upload do chunk:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno do servidor' },
            { status: 500 }
        );
    }
});
