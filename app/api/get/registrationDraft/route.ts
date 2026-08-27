import { ObjectId } from 'mongodb';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';

function value(...candidates: unknown[]) {
    const found = candidates.find((candidate) =>
        candidate !== null && candidate !== undefined && String(candidate).trim(),
    );
    return found === undefined ? '' : String(found);
}

export const GET = withApiAuthRequired(async function GET(request: Request) {
    const userId = await getUserId(request);
    if (!userId || !ObjectId.isValid(userId)) {
        return Response.json({ error: 'not_authenticated' }, { status: 401 });
    }

    try {
        const { db } = await connectToDatabase();
        const owner = new ObjectId(userId);
        const user = await db.collection('usuarios').findOne(
            { _id: owner },
            {
                projection: {
                    pagamento: 1,
                    informacoes_usuario: 1,
                },
            },
        );
        if (!user || user.pagamento?.situacao !== 1) {
            return Response.json(
                { error: 'payment_not_confirmed', message: 'Pagamento ainda não confirmado.' },
                { status: 403 },
            );
        }

        const compraId = user.pagamento?.compraId;
        const session = compraId && ObjectId.isValid(String(compraId))
            ? await db.collection('pagamentos.sessoes').findOne(
                { _id: new ObjectId(String(compraId)), owner },
                { projection: { userProps: 1 } },
            )
            : null;
        const profile = user.informacoes_usuario ?? {};
        const address = profile.endereco ?? {};
        const payer = session?.userProps ?? {};

        return Response.json({
            name: value(profile.nome, payer.name),
            cpfCnpj: value(profile.cpf, payer.cpf),
            phone: value(profile.numero_telefone, payer.phone),
            postalCode: value(address.postalCode, payer.zipCode),
            address: value(address.address, payer.street),
            addressNumber: value(address.addressNumber, payer.number),
            complement: value(address.complement, payer.complement),
            province: value(address.province, payer.neighborhood),
            city: value(profile.cidade),
            country: value(profile.país, 'Brasil'),
            birthDate: value(profile.data_nascimento),
            referral: value(profile.onde_conheceu),
            academicStatus: value(profile.situacao_academica),
            course: value(profile.curso),
            graduationYear: value(profile.ano_conclusao),
            graduationSemester: value(profile.semestre_conclusao),
        });
    } catch {
        return Response.json({ error: 'registration_draft_failed' }, { status: 500 });
    }
});
