import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { getActivePaymentConfig, getEditionId } from '@/lib/payments/config';
import { hasConfirmedRegistrationForEdition } from '@/lib/payments/codes';
import {
    findRemoteWorkAccess,
    REMOTE_WORK_PRODUCT_TYPE,
    toPublicRemoteWorkAccess,
} from '@/lib/remote-work-access';
import { toPublicPaymentSession } from '@/lib/payments/public-session';

export const dynamic = 'force-dynamic';

export const GET = withApiAuthRequired(async function GET(request: Request) {
    const session = await getSession(request);
    const userId = String(session?.user?.sub || '').replace(/^auth0\|/, '');
    if (!ObjectId.isValid(userId)) {
        return NextResponse.json({ error: 'not_authenticated', message: 'Sessão inválida.' }, { status: 401 });
    }

    try {
        const { db } = await connectToDatabase();
        const config = await getActivePaymentConfig(db);
        if (!config) {
            return NextResponse.json({ error: 'payment_config_not_found', message: 'Configuração não encontrada.' }, { status: 404 });
        }
        const owner = new ObjectId(userId);
        const editionId = getEditionId(config);
        const [access, regularConfirmed, activeSession, user] = await Promise.all([
            findRemoteWorkAccess(db, owner, editionId),
            hasConfirmedRegistrationForEdition(db, owner, editionId),
            db.collection('pagamentos.sessoes').findOne({
                owner,
                edicaoId: editionId,
                type: REMOTE_WORK_PRODUCT_TYPE,
                status: { $in: ['OPEN', 'CREATING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
            }),
            db.collection('usuarios').findOne(
                { _id: owner },
                { projection: { 'informacoes_usuario.nome': 1, 'informacoes_usuario.email': 1, 'informacoes_usuario.cpf': 1 } },
            ),
        ]);

        return NextResponse.json({
            editionId,
            regularConfirmed,
            access: toPublicRemoteWorkAccess(access),
            activeSession: toPublicPaymentSession(activeSession),
            user: {
                name: String(user?.informacoes_usuario?.nome || access?.purchaser?.name || session?.user?.name || ''),
                email: String(user?.informacoes_usuario?.email || access?.purchaser?.email || session?.user?.email || ''),
                cpf: String(user?.informacoes_usuario?.cpf || access?.purchaser?.cpf || ''),
            },
        });
    } catch (error) {
        console.error('Falha ao consultar participação remota:', error);
        return NextResponse.json(
            { error: 'remote_access_lookup_failed', message: 'Não foi possível consultar a participação remota.' },
            { status: 500 },
        );
    }
});
