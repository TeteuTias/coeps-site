import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../lib/mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { validateHealthProfileComplement } from '@/lib/registration-profile';

// Grava só profissão, matrícula e unidade de origem de quem já está inscrito como profissional da saúde.
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
        const profile = validateHealthProfileComplement(data && typeof data === 'object' ? data : {});
        if (profile.ok === false) {
            return Response.json(
                { error: 'invalid_registration_data', message: profile.message },
                { status: 400 },
            );
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('usuarios').updateOne(
            {
                _id: new ObjectId(userId),
                isPos_registration: true,
                'pagamento.situacao': 1,
                'pagamento.tipo_pagamento': 'profissional_saude',
            },
            {
                $set: {
                    'informacoes_usuario.profissao': profile.value.profession,
                    'informacoes_usuario.matricula_municipio': profile.value.municipalRegistration,
                    'informacoes_usuario.unidade_origem': profile.value.originUnit,
                },
            },
        );
        if (result.matchedCount !== 1) {
            return Response.json(
                {
                    error: 'health_profile_not_allowed',
                    message: 'Este complemento é apenas para profissionais da saúde com inscrição confirmada.',
                },
                { status: 403 },
            );
        }

        return Response.json({ ok: true });
    } catch {
        return Response.json(
            { error: 'health_profile_failed', message: 'Não foi possível salvar seus dados. Tente novamente.' },
            { status: 500 },
        );
    }
});
