import { del } from '@vercel/blob';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';

export const maxDuration = 60;

export const DELETE: any = withApiAuthRequired(async function DELETE(request) {
    const session = await getSession(request);
    const userId = session?.user?.sub?.replace('auth0|', '');
    if (!userId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (Array.isArray(body?.chunkIds)) {
        const chunkIds: unknown[] = body.chunkIds;
        if (chunkIds.length < 1 || chunkIds.length > 100 || chunkIds.some(id => typeof id !== 'string' || !id)
            || new Set(chunkIds).size !== chunkIds.length) {
            return NextResponse.json({ error: 'IDs de partes inválidos.' }, { status: 400 });
        }
        try {
            const { db } = await connectToDatabase();
            const chunks = await db.collection('trabalhos_chunks').find({
                chunkId: { $in: chunkIds }, userId,
            }).toArray();
            if (chunks.length) {
                await del(chunks.map(chunk => chunk.url));
                await db.collection('trabalhos_chunks').deleteMany({
                    _id: { $in: chunks.map(chunk => chunk._id) }, userId,
                });
            }
            return NextResponse.json({ success: true });
        } catch (error) {
            console.error('Não foi possível remover partes pendentes:', error);
            return NextResponse.json({ error: 'Não foi possível remover as partes.' }, { status: 500 });
        }
    }
    if (typeof body?.fileId !== 'string' || !ObjectId.isValid(body.fileId)) {
        return NextResponse.json({ error: 'ID de arquivo inválido.' }, { status: 400 });
    }
    try {
        const { db } = await connectToDatabase();
        const file = await db.collection('trabalhos_blob').findOneAndDelete({
            _id: new ObjectId(body.fileId), userId, purpose: 'submission',
            submissionId: { $exists: false },
        });
        if (!file) return NextResponse.json({ success: true });
        try {
            await del(file.url);
        } catch (error) {
            console.error('Não foi possível remover o blob pendente:', error);
            return NextResponse.json({ success: true, warning: 'A limpeza do armazenamento ficou pendente.' });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Não foi possível remover o arquivo pendente:', error);
        return NextResponse.json({ error: 'Não foi possível remover o arquivo.' }, { status: 500 });
    }
});
