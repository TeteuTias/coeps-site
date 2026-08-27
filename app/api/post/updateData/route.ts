import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../lib/mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { normalizePaymentCustomerInput } from '@/lib/payments/customer-sync';
import { syncPendingAsaasCustomer } from '@/lib/payments/customer-profile-sync';
import { LGPD_CONSENT_VERSION } from '@/lib/registration-consent';

function requiredString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function dateIsValid(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

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

        const data = await request.json();
        if (data.lgpdAccepted !== true || data.lgpdVersion !== LGPD_CONSENT_VERSION) {
            return Response.json(
                { error: 'lgpd_consent_required', message: 'Aceite os termos de privacidade para concluir.' },
                { status: 400 },
            );
        }

        const owner = new ObjectId(userId);
        const { db } = await connectToDatabase();
        const userDb = await db.collection('usuarios').findOne({ _id: owner });
        if (!userDb || userDb.pagamento?.situacao !== 1) {
            return Response.json(
                {
                    error: 'payment_not_confirmed',
                    message: 'O cadastro completo será liberado após a confirmação do pagamento.',
                },
                { status: 403 },
            );
        }

        const payer = normalizePaymentCustomerInput({
            name: data.nome,
            cpfCnpj: data.cpf,
            postalCode: data.postalCode,
            addressNumber: data.addressNumber,
            complement: data.complement,
        });
        if (payer.ok === false) {
            return Response.json(
                { error: 'invalid_registration_data', message: payer.message },
                { status: 400 },
            );
        }

        const phone = String(data.numero_telefone ?? '').replace(/\D/g, '');
        const address = requiredString(data.address);
        const province = requiredString(data.province);
        const cityName = requiredString(data.cidade);
        const country = requiredString(data.pais) || 'Brasil';
        const birthDate = requiredString(data.data_nascimento);
        const referral = requiredString(data.onde_conheceu);
        const academicStatus = requiredString(data.situacao_academica);
        const course = requiredString(data.curso);
        const graduationYear = Number(data.ano_conclusao);
        const graduationSemester = Number(data.semestre_conclusao);
        if (
            phone.length < 10 ||
            phone.length > 11 ||
            !address ||
            !province ||
            !cityName ||
            !dateIsValid(birthDate) ||
            !referral ||
            !['estudante', 'formado'].includes(academicStatus) ||
            !course ||
            !Number.isInteger(graduationYear) ||
            graduationYear < 1900 ||
            graduationYear > 2100 ||
            ![1, 2].includes(graduationSemester)
        ) {
            return Response.json(
                { error: 'invalid_registration_data', message: 'Revise os campos obrigatórios do cadastro.' },
                { status: 400 },
            );
        }

        const now = new Date();
        const previousConsent = userDb.consentimentos?.lgpd;
        const acceptedAt = previousConsent?.aceito === true &&
            previousConsent?.versao === LGPD_CONSENT_VERSION
            ? previousConsent.aceitoEm
            : now;
        const email = String(user?.email || userDb.informacoes_usuario?.email || '').trim();
        const userInformation = {
            cpf: payer.value.cpfCnpj,
            numero_telefone: phone,
            nome: payer.value.name,
            email,
            data_criacao: userDb.informacoes_usuario?.data_criacao || now,
            titulo_honorario: userDb.informacoes_usuario?.titulo_honorario || '',
            país: country,
            cidade: cityName,
            data_nascimento: birthDate,
            onde_conheceu: referral,
            situacao_academica: academicStatus,
            curso: course,
            ano_conclusao: graduationYear,
            semestre_conclusao: graduationSemester,
            endereco: {
                postalCode: payer.value.postalCode,
                address,
                addressNumber: payer.value.addressNumber,
                complement: payer.value.complement || '',
                province,
            },
        };
        const hasCustomerId = typeof userDb.id_api === 'string' && Boolean(userDb.id_api.trim());
        const updateResult = await db.collection('usuarios').updateOne(
            { _id: owner, 'pagamento.situacao': 1 },
            {
                $set: {
                    isPos_registration: true,
                    informacoes_usuario: userInformation,
                    'consentimentos.lgpd': {
                        aceito: true,
                        aceitoEm: acceptedAt,
                        versao: LGPD_CONSENT_VERSION,
                    },
                    'integracoes.asaas.customerSync': {
                        status: hasCustomerId ? 'PENDING' : 'REVIEW_REQUIRED',
                        attempts: 0,
                        updatedAt: now,
                        ...(!hasCustomerId ? { lastError: 'CUSTOMER_ID_MISSING' } : {}),
                    },
                },
            },
        );

        if (updateResult.matchedCount !== 1) {
            return Response.json(
                { error: 'payment_state_changed', message: 'O pagamento precisa estar confirmado para concluir o cadastro.' },
                { status: 409 },
            );
        }

        const sync = hasCustomerId
            ? await syncPendingAsaasCustomer({
                db,
                owner,
                userId,
                apiUrl: process.env.ASAAS_API_URL,
                apiKey: process.env.ASAAS_API_KEY,
            })
            : { status: 'REVIEW_REQUIRED' as const };

        return Response.json({ success: true, asaasSync: sync.status });
    } catch {
        return Response.json(
            { error: 'internal_server_error', message: 'Não foi possível salvar os dados do usuário.' },
            { status: 500 },
        );
    }
});
