import { put, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { fileTypeStream } from 'file-type';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { validateWorkFile, workFileExtension } from '@/lib/academic-work-files';

export const maxDuration = 300;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace('auth0|', '');
    let finalBlob;
    try {
        const body = await request.json();
        const { chunkFileName, finalFileName, chunkIds, totalSize } = body;
        const originalName = String(body.originalName || finalFileName || '');
        if (typeof chunkFileName !== 'string' || !chunkFileName || chunkFileName.length > 255
            || !Array.isArray(chunkIds) || chunkIds.length < 1 || chunkIds.length > 100
            || chunkIds.some(id => typeof id !== 'string' || !id)
            || new Set(chunkIds).size !== chunkIds.length
            || !Number.isInteger(totalSize) || totalSize < 1 || totalSize > MAX_FILE_SIZE
            || originalName.length > 255) {
            return NextResponse.json({ error: 'Dados para reconstrução inválidos.' }, { status: 400 });
        }
        const basicError = validateWorkFile({ name: originalName, size: totalSize },
            { titulo: 'arquivo', formatos: ['.pdf', '.doc', '.docx'] }, MAX_FILE_SIZE);
        if (basicError) return NextResponse.json({ error: basicError }, { status: 400 });
        const { db } = await connectToDatabase();
        const chunks = await db.collection('trabalhos_chunks').find({
            chunkId: { $in: chunkIds }, userId, fileName: chunkFileName,
        }).toArray();
        if (chunks.length !== chunkIds.length) {
            return NextResponse.json({ error: 'Partes ausentes ou pertencentes a outro usuário.' }, { status: 400 });
        }
        const ordered = Array(chunkIds.length);
        for (const chunk of chunks) {
            if (chunk.totalChunks !== chunkIds.length || !Number.isInteger(chunk.chunkIndex)
                || chunk.chunkIndex < 0 || chunk.chunkIndex >= chunkIds.length
                || chunkIds[chunk.chunkIndex] !== chunk.chunkId || ordered[chunk.chunkIndex]) {
                return NextResponse.json({ error: 'Sequência de partes inválida.' }, { status: 400 });
            }
            ordered[chunk.chunkIndex] = chunk;
        }
        if (ordered.some(chunk => !chunk) || ordered.reduce((sum, chunk) => sum + chunk.size, 0) !== totalSize) {
            return NextResponse.json({ error: 'Tamanho ou sequência das partes não confere.' }, { status: 400 });
        }

        async function* source() {
            let totalRead = 0;
            for (const chunk of ordered) {
                const response = await fetch(chunk.url);
                if (!response.ok || !response.body) throw new Error('Falha ao ler uma parte.');
                let partRead = 0;
                for await (const piece of response.body) {
                    partRead += piece.length;
                    totalRead += piece.length;
                    if (partRead > chunk.size || totalRead > totalSize) throw new Error('Tamanho inesperado durante a leitura.');
                    yield piece;
                }
                if (partRead !== chunk.size) throw new Error('Parte incompleta.');
            }
            if (totalRead !== totalSize) throw new Error('Arquivo incompleto.');
        }
        const typedStream = await fileTypeStream(Readable.from(source()), { sampleSize: 65536 });
        const type = typedStream.fileType;
        const validationError = validateWorkFile({ name: originalName, size: totalSize, contentType: type?.mime },
            { titulo: 'arquivo', formatos: ['.pdf', '.doc', '.docx'] }, MAX_FILE_SIZE);
        if (!type || validationError) {
            typedStream.destroy();
            return NextResponse.json({ error: validationError || 'Tipo de arquivo não suportado.' }, { status: 415 });
        }
        const pathname = `${userId}/trabalhos/${randomUUID()}${workFileExtension(originalName)}`;
        finalBlob = await put(pathname, typedStream, {
            access: 'public', contentType: type.mime, multipart: true,
        });
        const uploadDate = new Date();
        const purpose = body.purpose === 'submission' ? 'submission' : 'correction';
        const fileInfo = {
            pathname: finalBlob.pathname, filename: pathname, originalName, url: finalBlob.url, userId,
            uploadDate, size: totalSize, contentType: type.mime, purpose,
            chunked: true, chunkIds,
        };
        const result = await db.collection('trabalhos_blob').insertOne(fileInfo);
        // O arquivo já está salvo. Falhas de limpeza não devem transformar sucesso em erro.
        try {
            await del(ordered.map(chunk => chunk.url));
            await db.collection('trabalhos_chunks').deleteMany({ chunkId: { $in: chunkIds }, userId });
        } catch (cleanupError) {
            console.error('Falha ao limpar partes de um trabalho concluído:', cleanupError);
        }
        return NextResponse.json({ success: true, data: {
            _id: result.insertedId.toString(), name: originalName, url: finalBlob.url,
            pathname: finalBlob.pathname, user_id: userId, size: totalSize,
            uploadDate: uploadDate.toISOString(),
        } });
    } catch (error) {
        console.error('Erro ao reconstruir arquivo:', error);
        if (finalBlob) await del(finalBlob.url).catch(() => {});
        return NextResponse.json({ error: 'internal_server_error', message: 'Não foi possível reconstruir o arquivo.' }, { status: 500 });
    }
});
