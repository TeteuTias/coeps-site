import { put, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';

export const maxDuration = 60;
const MAX_CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_CHUNKS = 100;

/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    let blob;
    try {
        const { user } = await getSession(request);
        const userId = user.sub.replace('auth0|', '');
        const formData = await request.formData();
        const chunk = formData.get('chunk');
        const chunkIndexText = formData.get('chunkIndex');
        const totalChunksText = formData.get('totalChunks');
        const fileName = formData.get('fileName');
        if (!chunk || typeof chunk.size !== 'number' || typeof fileName !== 'string'
            || fileName.length > 255 || !fileName.trim()
            || typeof chunkIndexText !== 'string' || typeof totalChunksText !== 'string') {
            return NextResponse.json({ error: 'Dados do chunk incompletos.' }, { status: 400 });
        }
        const chunkIndex = Number(chunkIndexText);
        const totalChunks = Number(totalChunksText);
        if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks)
            || totalChunks < 1 || totalChunks > MAX_TOTAL_CHUNKS
            || chunkIndex < 0 || chunkIndex >= totalChunks) {
            return NextResponse.json({ error: 'Índice ou quantidade de partes inválida.' }, { status: 400 });
        }
        if (chunk.size < 1 || chunk.size > MAX_CHUNK_SIZE) {
            return NextResponse.json({ error: 'Parte vazia ou maior que 10 MiB.' }, { status: 413 });
        }
        const chunkId = randomUUID();
        blob = await put(`${userId}/chunks/${chunkId}`, chunk, { access: 'public' });
        const { db } = await connectToDatabase();
        const result = await db.collection('trabalhos_chunks').insertOne({
            chunkId, pathname: blob.pathname, url: blob.url, userId, fileName,
            chunkIndex, totalChunks, size: chunk.size, uploadDate: new Date(),
        });
        return NextResponse.json({ chunkId, chunkIndex, _id: result.insertedId.toString() });
    } catch (error) {
        console.error('Erro ao enviar parte do arquivo:', error);
        if (blob) await del(blob.url).catch(() => {});
        return NextResponse.json({ error: 'internal_server_error', message: 'Não foi possível enviar esta parte do arquivo.' }, { status: 500 });
    }
});
