import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
// 👇 CORREÇÃO APLICADA AQUI
import { connectToDatabase } from '@/lib/mongodb';

export const GET = withApiAuthRequired(async function GET(request) {
    try {
        const { user } = await getSession(request);
        const userId = user.sub.replace("auth0|", "");

        const { db } = await connectToDatabase();
        const files = await db.collection('trabalhos_blob')
            .find({ userId: userId })
            .sort({ uploadDate: -1 })
            .toArray();

        return NextResponse.json(files);
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
    }
});
