import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { asaasRequestHeaders, isAsaasRetryableStatus } from './asaas.ts';
import {
    ensureAsaasCustomer,
    normalizeAsaasCustomerAddress,
    type AsaasCustomerPayload,
} from './customer-provisioning.ts';

export type PaymentCustomerInput = {
    name: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    complement?: string;
};

export type CardHolderInput = PaymentCustomerInput & {
    email: string;
    phone: string;
};

export type CustomerSyncStatus = 'SYNCED' | 'PENDING' | 'PROCESSING' | 'REVIEW_REQUIRED';

export type NormalizedPaymentCustomer = {
    name: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    complement?: string;
};

type ExistingCustomerUpdateResult =
    | { ok: true }
    | {
        ok: false;
        retryable: boolean;
        status: number | null;
        code:
            | 'CUSTOMER_UPDATE_REJECTED'
            | 'CUSTOMER_UPDATE_INVALID_RESPONSE'
            | 'CUSTOMER_UPDATE_UNKNOWN';
    };

export type PreparePaymentCustomerResult =
    | { ok: true; customerId: string; payer: NormalizedPaymentCustomer }
    | {
        ok: false;
        status: 400 | 409 | 422 | 503;
        code: string;
        message: string;
    };

function optionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
}

function cpfIsValid(value: string): boolean {
    if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

    for (let position = 9; position < 11; position += 1) {
        let sum = 0;
        for (let index = 0; index < position; index += 1) {
            sum += Number(value[index]) * (position + 1 - index);
        }
        const digit = ((sum * 10) % 11) % 10;
        if (Number(value[position]) !== digit) return false;
    }
    return true;
}

export function normalizePaymentCustomerInput(
    value: unknown,
): { ok: true; value: NormalizedPaymentCustomer } | { ok: false; message: string } {
    const input = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
    const name = optionalString(input.name ?? input.nome) || '';
    const cpfCnpj = String(input.cpfCnpj ?? input.cpf ?? '').replace(/\D/g, '');
    const postalCode = String(input.postalCode ?? input.cep ?? '').replace(/\D/g, '');
    const addressNumber = optionalString(input.addressNumber ?? input.numero) || '';
    const complement = optionalString(input.complement ?? input.complemento);

    if (name.length < 5) return { ok: false, message: 'Informe o nome completo do pagador.' };
    if (!cpfIsValid(cpfCnpj)) return { ok: false, message: 'Informe um CPF válido.' };
    if (postalCode.length !== 8) return { ok: false, message: 'Informe um CEP válido com 8 números.' };
    if (!addressNumber) return { ok: false, message: 'Informe o número do endereço.' };

    return {
        ok: true,
        value: {
            name,
            cpfCnpj,
            postalCode,
            addressNumber,
            ...(complement ? { complement: complement.slice(0, 255) } : {}),
        },
    };
}

export function normalizeCardHolderInput(
    value: unknown,
): { ok: true; value: CardHolderInput } | { ok: false; message: string } {
    const input = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
    const payer = normalizePaymentCustomerInput({
        ...input,
        complement: input.complement ?? input.addressComplement,
    });
    if (payer.ok === false) return payer;

    const email = optionalString(input.email) || '';
    const phone = String(input.phone ?? input.mobilePhone ?? '').replace(/\D/g, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, message: 'Informe um e-mail válido para o titular do cartão.' };
    }
    if (phone.length < 10 || phone.length > 11) {
        return { ok: false, message: 'Informe um telefone válido para o titular do cartão.' };
    }

    return { ok: true, value: { ...payer.value, email, phone } };
}

export function buildAsaasCustomerPayload(input: {
    userId: string;
    payer: NormalizedPaymentCustomer;
    email?: unknown;
    mobilePhone?: unknown;
    address?: unknown;
    province?: unknown;
}): AsaasCustomerPayload {
    const email = optionalString(input.email);
    const mobilePhone = optionalString(input.mobilePhone)?.replace(/\D/g, '');
    const address = normalizeAsaasCustomerAddress({
        postalCode: input.payer.postalCode,
        addressNumber: input.payer.addressNumber,
        complement: input.payer.complement,
        address: input.address,
        province: input.province,
    });

    return {
        name: input.payer.name,
        cpfCnpj: input.payer.cpfCnpj,
        observations: input.userId,
        notificationDisabled: true,
        externalReference: input.userId,
        ...(email ? { email } : {}),
        ...(mobilePhone ? { mobilePhone } : {}),
        ...address,
    };
}

export async function updateExistingAsaasCustomer(input: {
    customerId: string;
    customer: AsaasCustomerPayload;
    apiUrl: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
}): Promise<ExistingCustomerUpdateResult> {
    const fetchImpl = input.fetchImpl ?? fetch;
    try {
        const response = await fetchImpl(
            `${input.apiUrl.replace(/\/$/, '')}/customers/${encodeURIComponent(input.customerId)}`,
            {
                method: 'PUT',
                headers: asaasRequestHeaders(input.apiKey, { json: true, apiUrl: input.apiUrl }),
                signal: AbortSignal.timeout(10_000),
                body: JSON.stringify(input.customer),
            },
        );
        if (response.ok) {
            const body = await response.json().catch(() => null) as { id?: unknown } | null;
            if (String(body?.id || '').trim() === input.customerId) return { ok: true };
            return {
                ok: false,
                retryable: false,
                status: response.status,
                code: 'CUSTOMER_UPDATE_INVALID_RESPONSE',
            };
        }
        return {
            ok: false,
            retryable: isAsaasRetryableStatus(response.status),
            status: response.status,
            code: 'CUSTOMER_UPDATE_REJECTED',
        };
    } catch {
        return {
            ok: false,
            retryable: true,
            status: null,
            code: 'CUSTOMER_UPDATE_UNKNOWN',
        };
    }
}

function defaultPaymentState(owner: ObjectId) {
    return {
        _id: owner,
        situacao: 0,
        lista_pagamentos: [],
        situacao_animacao: false,
        tipo_pagamento: '',
    };
}

async function persistResolvedCustomer(
    db: Db,
    owner: ObjectId,
    customerId: string,
    now: Date,
) {
    await db.collection('usuarios').updateOne(
        { _id: owner },
        {
            $set: {
                id_api: customerId,
                'integracoes.asaas.customerSync': {
                    status: 'SYNCED' satisfies CustomerSyncStatus,
                    attempts: 0,
                    updatedAt: now,
                    lastSyncedAt: now,
                },
            },
            $setOnInsert: {
                isPos_registration: false,
                informacoes_usuario: {},
                pagamento: defaultPaymentState(owner),
            },
        },
        { upsert: true },
    );
}

export async function preparePaymentCustomer(input: {
    db: Db;
    owner: ObjectId;
    userId: string;
    existingCustomerId?: unknown;
    payer: unknown;
    email?: unknown;
    apiUrl: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
    now?: () => Date;
}): Promise<PreparePaymentCustomerResult> {
    const normalized = normalizePaymentCustomerInput(input.payer);
    if (normalized.ok === false) {
        return { ok: false, status: 400, code: 'INVALID_PAYMENT_DATA', message: normalized.message };
    }

    const now = input.now ?? (() => new Date());
    const customer = buildAsaasCustomerPayload({
        userId: input.userId,
        payer: normalized.value,
        email: input.email,
    });
    const storedCustomerId = optionalString(input.existingCustomerId);

    if (storedCustomerId) {
        const updated = await updateExistingAsaasCustomer({
            customerId: storedCustomerId,
            customer,
            apiUrl: input.apiUrl,
            apiKey: input.apiKey,
            fetchImpl: input.fetchImpl,
        });
        if (updated.ok === false) {
            const reviewRequired = updated.status === 404 || !updated.retryable;
            await input.db.collection('usuarios').updateOne(
                { _id: input.owner, id_api: storedCustomerId },
                {
                    $set: {
                        'integracoes.asaas.customerSync': {
                            status: reviewRequired ? 'REVIEW_REQUIRED' : 'PENDING',
                            attempts: 1,
                            updatedAt: now(),
                            lastError: updated.status === 404
                                ? 'CUSTOMER_ID_NOT_FOUND'
                                : updated.code,
                        },
                    },
                },
            );
            return {
                ok: false,
                status: updated.status === 404 ? 409 : updated.retryable ? 503 : 422,
                code: updated.status === 404 ? 'CUSTOMER_RECONCILIATION_REQUIRED' : updated.code,
                message: updated.status === 404
                    ? 'O cliente de pagamento vinculado exige revisão. Nenhuma nova cobrança foi criada.'
                    : 'Não foi possível atualizar os dados do pagador no Asaas.',
            };
        }
        await persistResolvedCustomer(input.db, input.owner, storedCustomerId, now());
        return { ok: true, customerId: storedCustomerId, payer: normalized.value };
    }

    const ensured = await ensureAsaasCustomer({
        db: input.db,
        userId: input.userId,
        customer,
        apiUrl: input.apiUrl,
        apiKey: input.apiKey,
        fetchImpl: input.fetchImpl,
        now,
    });
    if (ensured.ok === false) {
        return {
            ok: false,
            status: ensured.status,
            code: ensured.code,
            message: ensured.status === 409
                ? 'O cliente de pagamento está em processamento ou exige revisão.'
                : 'Não foi possível confirmar o cliente de pagamento no Asaas.',
        };
    }

    if (ensured.source !== 'created') {
        const updated = await updateExistingAsaasCustomer({
            customerId: ensured.customerId,
            customer,
            apiUrl: input.apiUrl,
            apiKey: input.apiKey,
            fetchImpl: input.fetchImpl,
        });
        if (updated.ok === false) {
            return {
                ok: false,
                status: updated.retryable ? 503 : 422,
                code: updated.code,
                message: 'O cliente foi localizado, mas seus dados não puderam ser atualizados.',
            };
        }
    }

    await persistResolvedCustomer(input.db, input.owner, ensured.customerId, now());
    return { ok: true, customerId: ensured.customerId, payer: normalized.value };
}
