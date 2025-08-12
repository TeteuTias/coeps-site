import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';

export const GET = withApiAuthRequired(async function GET(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace("auth0|", "");

    try {
        const { db } = await connectToDatabase();

        // Busca todos os trabalhos que pertencem ao usuário logado
        // Ordena pelos mais recentes primeiro
        const works = await db.collection('Dados_do_trabalho')
            .find({ userId: userId })
            .sort({ dataSubmissao: -1 })
            .toArray();

        // Retorna os trabalhos encontrados
        return NextResponse.json(works);

    } catch (error) {
        console.error('Erro ao buscar trabalhos submetidos:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar os trabalhos. Tente novamente mais tarde.' },
            { status: 500 }
        );
    }
});
