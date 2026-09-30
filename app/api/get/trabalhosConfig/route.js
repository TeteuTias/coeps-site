import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';

export const dynamic = 'force-dynamic';

/** @type {any} */
export const GET = withApiAuthRequired(async function GET() {
    try {
        const { db } = await connectToDatabase();
        const config = await db.collection('trabalhos_config').findOne({});
        if (!config) {
            return NextResponse.json({ error: 'Configuração de trabalhos indisponível.' }, { status: 404 });
        }
        return NextResponse.json(config);
    } catch (error) {
        console.error('Não foi possível consultar a configuração de trabalhos:', error);
        return NextResponse.json({
            error: 'internal_server_error',
            message: 'Não foi possível consultar as configurações de trabalhos.',
        }, { status: 500 });
    }
});
