import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../lib/mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { LGPD_CONSENT_VERSION } from '@/lib/registration-consent';

// Grava o aceite da LGPD pedido pela janela /painel/aceiteLgpd, no mesmo formato de /api/post/updateData.
export const POST = withApiAuthRequired(async function POST(request: Request) {
    try {
        const { user } = await getSession(request);
        const userId = String(user?.sub || '').replace(/^auth0\|/, '');
        if (!ObjectId.isValid(userId)) {
            return Response.json(
                { error: 'invalid_user_id', message: 'Identificador de usuário inválido.' },
                { status: 400 },
            );
        }

        const data = await request.json().catch(() => null);
        if (data?.lgpdAccepted !== true || data?.lgpdVersion !== LGPD_CONSENT_VERSION) {
            return Response.json(
                { error: 'lgpd_consent_required', message: 'Marque a caixa para aceitar a Política de Privacidade.' },
                { status: 400 },
            );
        }

        const { db } = await connectToDatabase();
        // Só grava se ainda não houver aceite da versão atual, para não trocar a data de quem já aceitou.
        // shortcut: um aceite de versão anterior é sobrescrito; guardar histórico quando a versão mudar.
        await db.collection('usuarios').updateOne(
            {
                _id: new ObjectId(userId),
                $nor: [{ 'consentimentos.lgpd.aceito': true, 'consentimentos.lgpd.versao': LGPD_CONSENT_VERSION }],
            },
            {
                $set: {
                    'consentimentos.lgpd': { aceito: true, aceitoEm: new Date(), versao: LGPD_CONSENT_VERSION },
                },
            },
        );

        return Response.json({ ok: true });
    } catch {
        return Response.json(
            { error: 'lgpd_consent_failed', message: 'Não foi possível registrar seu aceite. Tente novamente.' },
            { status: 500 },
        );
    }
});
