import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';

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


   
        const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.gif'];

        const fileExtension = originalFileName.slice(originalFileName.lastIndexOf('.')).toLowerCase();

    
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return NextResponse.json(
                { error: `Tipo de arquivo não suportado. Apenas ${ALLOWED_EXTENSIONS.join(', ')} são permitidos.` },
                { status: 415 } // 415 Unsupported Media Type
            );
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

        // O resto do código continua como antes, mas sem a validação do buffer
        const blob = await put(`${userId}/trabalhos/${file.name}`, file, {
            access: 'public',
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

    } catch (error) {
        console.error('Erro no upload:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno do servidor' },
            { status: 500 }
        );
    }
});
