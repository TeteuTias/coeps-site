import { ObjectId } from 'bson';
import { connectToDatabase } from '../../../lib/mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import type { IUser } from '@/lib/types/user/user.t';
import { asaasRequestHeaders, isAsaasRetryableStatus } from '@/lib/payments/asaas';
import { ensureAsaasCustomer } from '@/lib/payments/customer-provisioning';

export const POST = withApiAuthRequired(async function POST(request) {
    try {
        const { user } = await getSession();
        const userId = String(user.sub || '').replace(/^auth0\|/, '');
        if (!ObjectId.isValid(userId)) {
            return Response.json(
                { error: 'invalid_user_id', message: 'Identificador de usuário inválido.' },
                { status: 400 },
            );
        }

        const apiKey = process.env.ASAAS_API_KEY;
        const apiUrl = process.env.ASAAS_API_URL;
        if (!apiKey || !apiUrl) {
            return Response.json(
                { error: 'payment_gateway_not_configured', message: 'Gateway não configurado.' },
                { status: 503 },
            );
        }

        const data = await request.json();
        const userObjectId = new ObjectId(userId);
        const { db } = await connectToDatabase();
        const userDb: IUser | null = await db.collection('usuarios').findOne({
            _id: userObjectId,
        });
        const customerPayload = {
            name: data.nome,
            email: String(user.email || ''),
            cpfCnpj: data.cpf,
            mobilePhone: data.numero_telefone,
            observations: userId,
            notificationDisabled: true as const,
            externalReference: userId,
            phone: data.phone,
            address: data.address,
            addressNumber: data.addressNumber,
            complement: data.complement,
            province: data.province,
            postalCode: data.postalCode,
            city: data.cidade_nome,
        };

        let customerId = typeof userDb?.id_api === 'string' && userDb.id_api.trim()
            ? userDb.id_api.trim()
            : null;
        if (!customerId) {
            const ensuredCustomer = await ensureAsaasCustomer({
                db,
                userId,
                customer: customerPayload,
                apiUrl,
                apiKey,
            });
            if (ensuredCustomer.ok === false) {
                return Response.json(
                    {
                        error: ensuredCustomer.code.toLowerCase(),
                        message: ensuredCustomer.status === 409
                            ? 'O cadastro do cliente já está em processamento ou exige revisão.'
                            : 'Não foi possível confirmar o cadastro do cliente no gateway.',
                    },
                    { status: ensuredCustomer.status },
                );
            }
            customerId = ensuredCustomer.customerId;
        } else {
            // Comportamento existente preservado para Customer já vinculado.
            try {
                const response = await fetch(
                    `${apiUrl.replace(/\/$/, '')}/customers/${encodeURIComponent(customerId)}`,
                    {
                        method: 'PUT',
                        headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
                        signal: AbortSignal.timeout(10_000),
                        body: JSON.stringify(customerPayload),
                    },
                );
                if (!response.ok) {
                    const retryable =
                        isAsaasRetryableStatus(response.status) ||
                        [401, 403].includes(response.status);
                    return Response.json(
                        {
                            error: 'customer_update_failed',
                            message: 'Não foi possível atualizar o cliente no gateway.',
                        },
                        { status: retryable ? 503 : 422 },
                    );
                }
            } catch {
                return Response.json(
                    {
                        error: 'customer_update_response_unknown',
                        message: 'Não foi possível confirmar a atualização do cliente no gateway.',
                    },
                    { status: 503 },
                );
            }
        }

        const userInformation: IUser['informacoes_usuario'] = {
            cpf: data.cpf,
            numero_telefone: data.numero_telefone,
            nome: data.nome,
            email: String(user.email || ''),
            data_criacao: userDb?.informacoes_usuario?.data_criacao || new Date(),
            titulo_honorario: '',
            país: data.pais,
            cidade: data.cidade,
            data_nascimento: data.data_nascimento,
            onde_conheceu: data.onde_conheceu,
            curso: data.curso,
            ano_conclusao: Number(data.ano_conclusao),
            semestre_conclusao: Number(data.semestre_conclusao),
        };
        await db.collection('usuarios').updateOne(
            { _id: userObjectId },
            {
                $set: {
                    id_api: customerId,
                    isPos_registration: true,
                    informacoes_usuario: userInformation,
                },
                $setOnInsert: {
                    pagamento: {
                        _id: userObjectId,
                        situacao: 0,
                        lista_pagamentos: [],
                        situacao_animacao: false,
                        tipo_pagamento: '',
                    },
                },
            },
            { upsert: true },
        );
        return Response.json({ sucesso: 'Ocorreu Tudo Certo!' });
    } catch {
        return Response.json(
            { error: 'internal_server_error', message: 'Não foi possível salvar os dados do usuário.' },
            { status: 500 },
        );
    }
});
