import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';

export const GET = withApiAuthRequired(async function GET(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace("auth0|", "");

    try {
        const { db } = await connectToDatabase();

        // buscar trabalhos do usuário 
        const trabalhos = await db.collection('Dados_do_trabalho')
            .find({ userId })
            .sort({ dataSubmissao: -1 })
            .toArray();

        // Expandir tópicos abreviados 
        const trabalhosComTopicos = trabalhos.map(trabalho => ({
            ...trabalho,
            topicos: trabalho.topicos ? {
                resumo: trabalho.topicos.resu || '',
                introducao: trabalho.topicos.intro || '',
                objetivo: trabalho.topicos.obj || '',
                metodo: trabalho.topicos.met || '',
                discussaoResultados: trabalho.topicos.disc || '',
                conclusao: trabalho.topicos.conc || '',
                palavrasChave: trabalho.topicos.pchave || '',
                referencias: trabalho.topicos.ref || ''
            } : null
        }));

        return NextResponse.json(trabalhosComTopicos);

    } catch (error) {
        console.error('Erro ao buscar trabalhos submetidos:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar os trabalhos. Tente novamente mais tarde.' },
            { status: 500 }
        );
    }
});