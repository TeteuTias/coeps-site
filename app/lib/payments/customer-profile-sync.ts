import { randomUUID } from 'node:crypto';
import { ObjectId, type Db, type Document } from 'mongodb';
import {
    buildAsaasCustomerPayload,
    normalizePaymentCustomerInput,
    updateExistingAsaasCustomer,
    type CustomerSyncStatus,
} from './customer-sync.ts';

type SyncResult = {
    status: CustomerSyncStatus | 'IDLE';
};

function syncPath(field: string) {
    return `integracoes.asaas.customerSync.${field}`;
}

function buildProfileCustomer(user: Document, userId: string) {
    const profile = user.informacoes_usuario ?? {};
    const address = profile.endereco ?? {};
    const normalized = normalizePaymentCustomerInput({
        name: profile.nome,
        cpfCnpj: profile.cpf,
        postalCode: address.postalCode,
        addressNumber: address.addressNumber,
        complement: address.complement,
    });
    if (normalized.ok === false) return null;

    return buildAsaasCustomerPayload({
        userId,
        payer: normalized.value,
        email: profile.email,
        mobilePhone: profile.numero_telefone,
        address: address.address,
        province: address.province,
    });
}

async function finishSync(
    db: Db,
    owner: ObjectId,
    leaseOwner: string,
    state: Record<string, unknown>,
) {
    await db.collection('usuarios').updateOne(
        { _id: owner, [syncPath('leaseOwner')]: leaseOwner },
        {
            $set: {
                ...state,
                [syncPath('updatedAt')]: new Date(),
            },
            $unset: {
                [syncPath('leaseOwner')]: '',
                [syncPath('leaseUntil')]: '',
            },
        },
    );
}

export async function syncPendingAsaasCustomer(input: {
    db: Db;
    owner: ObjectId;
    userId: string;
    apiUrl?: string;
    apiKey?: string;
    fetchImpl?: typeof fetch;
    now?: () => Date;
}): Promise<SyncResult> {
    const now = input.now ?? (() => new Date());
    const startedAt = now();
    const leaseOwner = randomUUID();
    const leaseUntil = new Date(startedAt.getTime() + 60_000);
    const collection = input.db.collection('usuarios');
    const user = await collection.findOneAndUpdate(
        {
            _id: input.owner,
            $or: [
                {
                    [syncPath('status')]: 'PENDING',
                    [syncPath('nextAttemptAt')]: { $exists: false },
                },
                {
                    [syncPath('status')]: 'PENDING',
                    [syncPath('nextAttemptAt')]: { $lte: startedAt },
                },
                {
                    [syncPath('status')]: 'PROCESSING',
                    [syncPath('leaseUntil')]: { $lte: startedAt },
                },
            ],
        },
        {
            $set: {
                [syncPath('status')]: 'PROCESSING',
                [syncPath('leaseOwner')]: leaseOwner,
                [syncPath('leaseUntil')]: leaseUntil,
                [syncPath('updatedAt')]: startedAt,
            },
            $inc: { [syncPath('attempts')]: 1 },
            $unset: { [syncPath('nextAttemptAt')]: '' },
        },
        { returnDocument: 'after' },
    );

    if (!user) return { status: 'IDLE' };
    const customerId = typeof user.id_api === 'string' ? user.id_api.trim() : '';
    const customer = buildProfileCustomer(user, input.userId);
    if (!customerId || !customer) {
        await finishSync(input.db, input.owner, leaseOwner, {
            [syncPath('status')]: 'REVIEW_REQUIRED',
            [syncPath('lastError')]: !customerId ? 'CUSTOMER_ID_MISSING' : 'CUSTOMER_PROFILE_INVALID',
        });
        return { status: 'REVIEW_REQUIRED' };
    }

    if (!input.apiUrl || !input.apiKey) {
        await finishSync(input.db, input.owner, leaseOwner, {
            [syncPath('status')]: 'REVIEW_REQUIRED',
            [syncPath('lastError')]: 'ASAAS_NOT_CONFIGURED',
        });
        return { status: 'REVIEW_REQUIRED' };
    }

    const result = await updateExistingAsaasCustomer({
        customerId,
        customer,
        apiUrl: input.apiUrl,
        apiKey: input.apiKey,
        fetchImpl: input.fetchImpl,
    });
    if (result.ok === true) {
        await finishSync(input.db, input.owner, leaseOwner, {
            [syncPath('status')]: 'SYNCED',
            [syncPath('lastSyncedAt')]: now(),
            [syncPath('lastError')]: null,
        });
        return { status: 'SYNCED' };
    }

    if (!result.retryable) {
        await finishSync(input.db, input.owner, leaseOwner, {
            [syncPath('status')]: 'REVIEW_REQUIRED',
            [syncPath('lastError')]: result.status
                ? `CUSTOMER_UPDATE_HTTP_${result.status}`
                : result.code,
        });
        return { status: 'REVIEW_REQUIRED' };
    }

    const attempts = Math.max(1, Number(user.integracoes?.asaas?.customerSync?.attempts || 1));
    const retryDelayMinutes = Math.min(24 * 60, 5 * (2 ** Math.min(attempts - 1, 8)));
    await finishSync(input.db, input.owner, leaseOwner, {
        [syncPath('status')]: 'PENDING',
        [syncPath('nextAttemptAt')]: new Date(now().getTime() + retryDelayMinutes * 60_000),
        [syncPath('lastError')]: result.status
            ? `CUSTOMER_UPDATE_HTTP_${result.status}`
            : result.code,
    });
    return { status: 'PENDING' };
}
