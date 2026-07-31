import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { fileTypeFromBuffer } from 'file-type';

// 👇 **CORREÇÃO: Mudar o runtime para 'edge'**
 // 60 segundos

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = [
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'image/jpeg', 'image/png', 'image/gif',
    'application/zip', 'application/x-rar-compressed', 'application/gzip'
];

/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace("auth0|", "");
    let originalFileName = '';

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        originalFileName = formData.get('originalFileName') || (file ? file.name : '');

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        const existingFile = await db.collection('trabalhos_blob').findOne({
            userId: userId,
            filename: originalFileName
        });

        if (existingFile) {
            return NextResponse.json(
                { error: `Você já enviou um arquivo com o nome "${originalFileName}".` },
                { status: 409 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'O arquivo excede o limite de 100MB.' }, { status: 413 });
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const type = await fileTypeFromBuffer(fileBuffer);

        if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) {
            return NextResponse.json({ error: 'Tipo de arquivo não suportado.' }, { status: 415 });
        }

        const blob = await put(`${userId}/trabalhos/${file.name}`, fileBuffer, {
            access: 'public',
            contentType: type.mime,
        });

        const fileInfo = {
            pathname: blob.pathname,
            filename: originalFileName,
            url: blob.url,
            userId: userId,
            uploadDate: new Date(),
            size: file.size,
            chunked: false
        };
        const result = await db.collection('trabalhos_blob').insertOne(fileInfo);

        const fileData = {
            _id: result.insertedId.toString(),
            name: originalFileName,
            url: blob.url,
            pathname: blob.pathname,
            user_id: userId,
            size: file.size,
            uploadDate: fileInfo.uploadDate.toISOString(),
        };

        return NextResponse.json({ success: true, data: fileData });

    } catch {
        return NextResponse.json(
            { error: 'internal_server_error', message: 'Não foi possível enviar o arquivo.' },
            { status: 500 }
        );
    }
});
