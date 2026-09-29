import { put, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { fileTypeFromBuffer } from 'file-type';
import { validateWorkFile, workFileExtension } from '@/lib/academic-work-files';

export const maxDuration = 60;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace('auth0|', '');
    let blob;
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || typeof file.name !== 'string') {
            return NextResponse.json({ error: 'Nenhum arquivo fornecido.' }, { status: 400 });
        }
        const originalName = String(formData.get('originalFileName') || file.name);
        const purpose = formData.get('purpose') === 'submission' ? 'submission' : 'correction';
        const extension = workFileExtension(originalName);
        const basicError = validateWorkFile({ name: originalName, size: file.size },
            { titulo: 'arquivo', formatos: ['.pdf', '.doc', '.docx'] }, MAX_FILE_SIZE);
        if (basicError) return NextResponse.json({ error: basicError }, { status: 400 });

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const type = await fileTypeFromBuffer(fileBuffer);
        const validationError = validateWorkFile({ name: originalName, size: file.size, contentType: type?.mime },
            { titulo: 'arquivo', formatos: ['.pdf', '.doc', '.docx'] }, MAX_FILE_SIZE);
        if (!type || validationError) {
            return NextResponse.json({ error: validationError || 'Tipo de arquivo não suportado.' }, { status: 415 });
        }

        const pathname = `${userId}/trabalhos/${randomUUID()}${extension}`;
        blob = await put(pathname, fileBuffer, { access: 'public', contentType: type.mime });
        const { db } = await connectToDatabase();
        const uploadDate = new Date();
        const fileInfo = {
            pathname: blob.pathname, filename: pathname, originalName, url: blob.url, userId,
            uploadDate, size: file.size, contentType: type.mime, purpose, chunked: false,
        };
        const result = await db.collection('trabalhos_blob').insertOne(fileInfo);
        return NextResponse.json({ success: true, data: {
            _id: result.insertedId.toString(), name: originalName, url: blob.url,
            pathname: blob.pathname, user_id: userId, size: file.size, uploadDate: uploadDate.toISOString(),
        } });
    } catch (error) {
        console.error('Erro ao enviar arquivo:', error);
        if (blob) await del(blob.url).catch(() => {});
        return NextResponse.json({ error: 'internal_server_error', message: 'Não foi possível enviar o arquivo.' }, { status: 500 });
    }
});
