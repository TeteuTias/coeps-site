import { randomUUID } from 'node:crypto';
import type { Db, Document } from 'mongodb';
import { asaasRequestHeaders, isAsaasRetryableStatus } from './asaas.ts';

export const CUSTOMER_PROVISIONING_COLLECTION = 'pagamentos.customer_provisioning';

export interface CustomerProvisioningDocument extends Document {
    _id: string;
    status?: string;
    customerId?: string;
    leaseOwner?: string;
    leaseUntil?: Date;
}

export type AsaasCustomerPayload = {
    name: string;
    cpfCnpj: string;
    observations: string;
    notificationDisabled: true;
    externalReference: string;
    email?: string;
    mobilePhone?: string;
    phone?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    postalCode?: string;
};

export type AsaasCustomerAddress = Pick<
    AsaasCustomerPayload,
    'address' | 'addressNumber' | 'complement' | 'province' | 'postalCode'
>;

type AsaasErrorPayload = {
    errors?: Array<{
        code?: unknown;
        description?: unknown;
    }>;
};

export type AsaasCustomerCityRepairResult =
    | { ok: true; city: string | number }
    | {
        ok: false;
        code: 'CUSTOMER_ADDRESS_INVALID' | 'CUSTOMER_ADDRESS_UPDATE_FAILED';
        status: 422 | 503;
    };

export type AsaasCheckoutWithCityRepairResult =
    | {
        kind: 'response';
        response: Response;
        body: Record<string, any>;
        repairAttempted: boolean;
    }
    | {
        kind: 'checkout_unknown';
        repairAttempted: boolean;
    }
    | {
        kind: 'repair_failed';
        repair: Exclude<AsaasCustomerCityRepairResult, { ok: true }>;
    };

type EnsureCustomerOptions = {
    db: Db;
    userId: string;
    customer: AsaasCustomerPayload;
    apiUrl: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
    now?: () => Date;
};

type RepairCustomerCityOptions = {
    customerId: string;
    address: Record<string, unknown>;
    apiUrl: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
};

type CheckoutWithCityRepairOptions = RepairCustomerCityOptions & {
    checkout: Record<string, unknown>;
};

export type EnsureCustomerResult =
    | { ok: true; customerId: string; source: 'stored' | 'lookup' | 'created' }
    | {
        ok: false;
        code:
            | 'CUSTOMER_PROVISIONING_BUSY'
            | 'CUSTOMER_LOOKUP_FAILED'
            | 'CUSTOMER_CREATE_REJECTED'
            | 'CUSTOMER_RECONCILIATION_REQUIRED';
        status: 409 | 422 | 503;
    };

function isDuplicateKey(error: unknown) {
    return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        Number((error as { code?: unknown }).code) === 11000,
    );
}

function customerId(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}

function asaasCity(value: unknown): string | number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
    return null;
}

export function normalizeAsaasCustomerAddress(
    address: Record<string, unknown>,
): AsaasCustomerAddress {
    const postalCodeDigits = String(address.postalCode || '').replace(/\D/g, '');
    const complement = optionalString(address.complement);
    const normalized: AsaasCustomerAddress = {
        ...(optionalString(address.address) ? { address: optionalString(address.address) } : {}),
        ...(optionalString(address.addressNumber)
            ? { addressNumber: optionalString(address.addressNumber) }
            : {}),
        ...(complement && complement.toLocaleLowerCase('pt-BR') !== 'não informado'
            ? { complement }
            : {}),
        ...(optionalString(address.province) ? { province: optionalString(address.province) } : {}),
        ...(postalCodeDigits.length === 8 ? { postalCode: postalCodeDigits } : {}),
    };
    return normalized;
}

export function isAsaasMissingCustomerCityError(payload: unknown): boolean {
    const errors = (payload as AsaasErrorPayload | null)?.errors;
    if (!Array.isArray(errors)) return false;

    return errors.some((error) => {
        if (String(error?.code || '').toLowerCase() !== 'invalid_object') return false;
        const description = String(error?.description || '').toLowerCase();
        return (
            description.includes('campo city') &&
            description.includes('deve existir') &&
            description.includes('customer')
        );
    });
}

export async function repairAsaasCustomerCity({
    customerId: rawCustomerId,
    address,
    apiUrl,
    apiKey,
    fetchImpl = fetch,
}: RepairCustomerCityOptions): Promise<AsaasCustomerCityRepairResult> {
    const normalizedCustomerId = customerId(rawCustomerId);
    const normalizedAddress = normalizeAsaasCustomerAddress(address);
    if (!normalizedCustomerId || !normalizedAddress.postalCode) {
        return { ok: false, code: 'CUSTOMER_ADDRESS_INVALID', status: 422 };
    }

    const customerUrl = `${apiUrl.replace(/\/$/, '')}/customers/${encodeURIComponent(normalizedCustomerId)}`;
    let updateResponse: Response;
    try {
        updateResponse = await fetchImpl(customerUrl, {
            method: 'PUT',
            headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify(normalizedAddress),
        });
    } catch {
        return { ok: false, code: 'CUSTOMER_ADDRESS_UPDATE_FAILED', status: 503 };
    }

    const updateBody = await updateResponse.json().catch(() => null) as Record<string, unknown> | null;
    if (!updateResponse.ok) {
        const retryable =
            isAsaasRetryableStatus(updateResponse.status) ||
            [401, 403].includes(updateResponse.status);
        return {
            ok: false,
            code: 'CUSTOMER_ADDRESS_UPDATE_FAILED',
            status: retryable ? 503 : 422,
        };
    }

    const updatedCity = asaasCity(updateBody?.city);
    if (updatedCity !== null) return { ok: true, city: updatedCity };

    let lookupResponse: Response;
    try {
        lookupResponse = await fetchImpl(customerUrl, {
            headers: asaasRequestHeaders(apiKey, { apiUrl }),
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        return { ok: false, code: 'CUSTOMER_ADDRESS_UPDATE_FAILED', status: 503 };
    }

    const lookupBody = await lookupResponse.json().catch(() => null) as Record<string, unknown> | null;
    if (!lookupResponse.ok) {
        const retryable =
            isAsaasRetryableStatus(lookupResponse.status) ||
            [401, 403].includes(lookupResponse.status);
        return {
            ok: false,
            code: 'CUSTOMER_ADDRESS_UPDATE_FAILED',
            status: retryable ? 503 : 422,
        };
    }

    const confirmedCity = asaasCity(lookupBody?.city);
    return confirmedCity !== null
        ? { ok: true, city: confirmedCity }
        : { ok: false, code: 'CUSTOMER_ADDRESS_INVALID', status: 422 };
}

async function createAsaasCheckout(
    apiUrl: string,
    apiKey: string,
    checkout: Record<string, unknown>,
    fetchImpl: typeof fetch,
) {
    try {
        const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/checkouts`, {
            method: 'POST',
            headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify(checkout),
        });
        const body = await response.json().catch(() => ({})) as Record<string, any>;
        return { ok: true as const, response, body };
    } catch {
        return { ok: false as const };
    }
}

export async function createAsaasCheckoutWithCustomerCityRepair({
    customerId: rawCustomerId,
    address,
    apiUrl,
    apiKey,
    checkout,
    fetchImpl = fetch,
}: CheckoutWithCityRepairOptions): Promise<AsaasCheckoutWithCityRepairResult> {
    const firstAttempt = await createAsaasCheckout(apiUrl, apiKey, checkout, fetchImpl);
    if (!firstAttempt.ok) {
        return { kind: 'checkout_unknown', repairAttempted: false };
    }
    if (firstAttempt.response.ok || !isAsaasMissingCustomerCityError(firstAttempt.body)) {
        return {
            kind: 'response',
            response: firstAttempt.response,
            body: firstAttempt.body,
            repairAttempted: false,
        };
    }

    const repair = await repairAsaasCustomerCity({
        customerId: rawCustomerId,
        address,
        apiUrl,
        apiKey,
        fetchImpl,
    });
    if (repair.ok === false) return { kind: 'repair_failed', repair };

    const secondAttempt = await createAsaasCheckout(apiUrl, apiKey, checkout, fetchImpl);
    if (!secondAttempt.ok) {
        return { kind: 'checkout_unknown', repairAttempted: true };
    }
    return {
        kind: 'response',
        response: secondAttempt.response,
        body: secondAttempt.body,
        repairAttempted: true,
    };
}

async function setProvisioningState(
    db: Db,
    userId: string,
    leaseOwner: string,
    state: Record<string, unknown>,
) {
    await db.collection<CustomerProvisioningDocument>(CUSTOMER_PROVISIONING_COLLECTION).updateOne(
        { _id: userId, leaseOwner },
        {
            $set: { ...state, updatedAt: new Date() },
            $unset: { leaseOwner: '', leaseUntil: '' },
        },
    );
}

export async function ensureAsaasCustomer({
    db,
    userId,
    customer,
    apiUrl,
    apiKey,
    fetchImpl = fetch,
    now = () => new Date(),
}: EnsureCustomerOptions): Promise<EnsureCustomerResult> {
    const collection = db.collection<CustomerProvisioningDocument>(
        CUSTOMER_PROVISIONING_COLLECTION,
    );
    const startedAt = now();
    const leaseOwner = randomUUID();
    const leaseUntil = new Date(startedAt.getTime() + 60_000);

    try {
        await collection.findOneAndUpdate(
            {
                _id: userId,
                $or: [
                    { status: { $exists: false } },
                    { status: { $in: ['RECONCILIATION_REQUIRED', 'FAILED'] } },
                    { status: 'PROCESSING', leaseUntil: { $lte: startedAt } },
                ],
            },
            {
                $setOnInsert: { createdAt: startedAt },
                $set: {
                    status: 'PROCESSING',
                    leaseOwner,
                    leaseUntil,
                    updatedAt: startedAt,
                },
                $inc: { attempts: 1 },
            },
            { upsert: true, returnDocument: 'after' },
        );
    } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const existing = await collection.findOne(
            { _id: userId },
            { projection: { status: 1, customerId: 1 } },
        );
        const storedCustomerId = customerId(existing?.customerId);
        if (existing?.status === 'RESOLVED' && storedCustomerId) {
            return { ok: true, customerId: storedCustomerId, source: 'stored' };
        }
        return { ok: false, code: 'CUSTOMER_PROVISIONING_BUSY', status: 409 };
    }

    const customersUrl = `${apiUrl.replace(/\/$/, '')}/customers`;
    const lookupUrl = `${customersUrl}?externalReference=${encodeURIComponent(userId)}&limit=2`;
    let lookupResponse: Response;
    try {
        lookupResponse = await fetchImpl(lookupUrl, {
            headers: asaasRequestHeaders(apiKey, { apiUrl }),
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'RECONCILIATION_REQUIRED',
            reason: 'CUSTOMER_LOOKUP_NETWORK_FAILURE',
        });
        return { ok: false, code: 'CUSTOMER_LOOKUP_FAILED', status: 503 };
    }

    if (!lookupResponse.ok) {
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'RECONCILIATION_REQUIRED',
            reason: `CUSTOMER_LOOKUP_HTTP_${lookupResponse.status}`,
        });
        return { ok: false, code: 'CUSTOMER_LOOKUP_FAILED', status: 503 };
    }

    const lookupBody = await lookupResponse.json().catch(() => null) as {
        data?: Array<{ id?: unknown; externalReference?: unknown }>;
    } | null;
    if (!Array.isArray(lookupBody?.data)) {
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'RECONCILIATION_REQUIRED',
            reason: 'CUSTOMER_LOOKUP_INVALID_RESPONSE',
        });
        return { ok: false, code: 'CUSTOMER_LOOKUP_FAILED', status: 503 };
    }
    const matches = lookupBody.data.filter(
        (candidate) =>
            String(candidate?.externalReference || '') === userId &&
            Boolean(customerId(candidate?.id)),
    );

    if (matches.length > 1) {
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'REVIEW_REQUIRED',
            reason: 'MULTIPLE_ASAAS_CUSTOMERS_FOR_EXTERNAL_REFERENCE',
        });
        return {
            ok: false,
            code: 'CUSTOMER_RECONCILIATION_REQUIRED',
            status: 409,
        };
    }

    if (matches.length === 1) {
        const matchedCustomerId = customerId(matches[0].id)!;
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'RESOLVED',
            customerId: matchedCustomerId,
            source: 'LOOKUP',
            resolvedAt: now(),
        });
        return { ok: true, customerId: matchedCustomerId, source: 'lookup' };
    }

    let createResponse: Response;
    try {
        createResponse = await fetchImpl(customersUrl, {
            method: 'POST',
            headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify(customer),
        });
    } catch {
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'RECONCILIATION_REQUIRED',
            reason: 'CUSTOMER_CREATE_RESPONSE_UNKNOWN',
        });
        return {
            ok: false,
            code: 'CUSTOMER_RECONCILIATION_REQUIRED',
            status: 503,
        };
    }

    if (!createResponse.ok) {
        const retryable =
            isAsaasRetryableStatus(createResponse.status) ||
            [401, 403].includes(createResponse.status);
        await setProvisioningState(db, userId, leaseOwner, {
            status: retryable ? 'RECONCILIATION_REQUIRED' : 'FAILED',
            reason: `CUSTOMER_CREATE_HTTP_${createResponse.status}`,
        });
        return {
            ok: false,
            code: retryable
                ? 'CUSTOMER_RECONCILIATION_REQUIRED'
                : 'CUSTOMER_CREATE_REJECTED',
            status: retryable ? 503 : 422,
        };
    }

    const createdBody = await createResponse.json().catch(() => null) as { id?: unknown } | null;
    const createdCustomerId = customerId(createdBody?.id);
    if (!createdCustomerId) {
        await setProvisioningState(db, userId, leaseOwner, {
            status: 'RECONCILIATION_REQUIRED',
            reason: 'CUSTOMER_CREATE_ID_MISSING',
        });
        return {
            ok: false,
            code: 'CUSTOMER_RECONCILIATION_REQUIRED',
            status: 503,
        };
    }

    await setProvisioningState(db, userId, leaseOwner, {
        status: 'RESOLVED',
        customerId: createdCustomerId,
        source: 'CREATED',
        resolvedAt: now(),
    });
    return { ok: true, customerId: createdCustomerId, source: 'created' };
}
