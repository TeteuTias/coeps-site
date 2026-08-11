import { createHash } from 'node:crypto';
import type { Db, Document, WithId } from 'mongodb';
import { ObjectId } from 'mongodb';

export const LEGACY_WEBHOOK_EVENTS_COLLECTION = 'pagamentos.webhook_eventos';
export const WEBHOOK_EVENTS_V2_COLLECTION = 'pagamentos.webhook_eventos_v2';
export const WEBHOOK_EVENT_UNIQUE_INDEX = 'payment_webhook_event_v2_unique';
export const WEBHOOK_WORKER_LOCKS_COLLECTION = 'pagamentos.webhook_worker_locks';
export const WEBHOOK_WORKER_LOCK_ID = 'asaas-global-fifo';

const PROCESSING_LEASE_MS = 5 * 60_000;
const WORKER_LEASE_MS = 5 * 60_000;
const PROCESSED_RETENTION_MS = 90 * 24 * 60 * 60_000;
const RETRY_DELAYS_MS = [5_000, 30_000];
const MAX_AUTOMATIC_ATTEMPTS = 3;

export type WebhookEventStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'PROCESSED'
    | 'FAILED'
    | 'REVIEW_REQUIRED';

export interface WebhookEventV2 extends Document {
    _id: ObjectId;
    provider: 'ASAAS';
    eventId: string;
    eventType: string;
    paymentId: string | null;
    installmentId: string | null;
    payload: Record<string, unknown>;
    payloadHash: string;
    status: WebhookEventStatus;
    attempts: number;
    receivedAt: Date;
    updatedAt: Date;
    leaseUntil?: Date;
    nextAttemptAt?: Date;
    processedAt?: Date;
    expiresAt?: Date;
    lastError?: string;
    reviewReason?: string;
}

interface WebhookWorkerLock extends Document {
    _id: string;
    owner?: string;
    leaseUntil?: Date;
}

type IngestResult =
    | { kind: 'legacy_quarantined'; eventId: string }
    | { kind: 'duplicate'; eventId: string; ledgerId: ObjectId; status: WebhookEventStatus }
    | { kind: 'accepted'; eventId: string; ledgerId: ObjectId };

const readinessByDatabase = new Map<string, Promise<boolean>>();

function payloadHash(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function getRequiredWebhookEventId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const id = (payload as { id?: unknown }).id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export function clearWebhookLedgerReadinessCache(): void {
    readinessByDatabase.clear();
}

export async function ensureWebhookLedgerReady(db: Db): Promise<boolean> {
    const cacheKey = `${db.databaseName}:${WEBHOOK_EVENTS_V2_COLLECTION}`;
    let readiness = readinessByDatabase.get(cacheKey);

    if (!readiness) {
        readiness = (async () => {
            const indexes = await db.collection(WEBHOOK_EVENTS_V2_COLLECTION).listIndexes().toArray();
            const unique = indexes.find((index) => index.name === WEBHOOK_EVENT_UNIQUE_INDEX);
            return Boolean(
                unique?.unique === true &&
                unique?.key?.provider === 1 &&
                unique?.key?.eventId === 1,
            );
        })().catch(() => false);
        readinessByDatabase.set(cacheKey, readiness);
    }

    const ready = await readiness;
    if (!ready) readinessByDatabase.delete(cacheKey);
    return ready;
}

export async function ingestWebhookEvent(
    db: Db,
    payload: Record<string, unknown>,
): Promise<IngestResult> {
    const eventId = getRequiredWebhookEventId(payload);
    if (!eventId) throw new Error('WEBHOOK_EVENT_ID_REQUIRED');

    const legacyExists = await db.collection(LEGACY_WEBHOOK_EVENTS_COLLECTION).findOne(
        { provider: 'ASAAS', eventId },
        { projection: { _id: 1 } },
    );
    if (legacyExists) return { kind: 'legacy_quarantined', eventId };

    const now = new Date();
    const document: WebhookEventV2 = {
        _id: new ObjectId(),
        provider: 'ASAAS',
        eventId,
        eventType: String(payload.event || 'UNKNOWN'),
        paymentId:
            payload.payment && typeof payload.payment === 'object'
                ? String((payload.payment as { id?: unknown }).id || '') || null
                : null,
        installmentId:
            payload.payment && typeof payload.payment === 'object'
                ? String((payload.payment as { installment?: unknown }).installment || '') || null
                : null,
        payload,
        payloadHash: payloadHash(payload),
        status: 'PENDING',
        attempts: 0,
        receivedAt: now,
        updatedAt: now,
        nextAttemptAt: now,
    };

    try {
        await db.collection<WebhookEventV2>(WEBHOOK_EVENTS_V2_COLLECTION).insertOne(document);
        return { kind: 'accepted', eventId, ledgerId: document._id };
    } catch (error) {
        if ((error as { code?: number })?.code !== 11000) throw error;
    }

    const duplicate = await db.collection<WebhookEventV2>(WEBHOOK_EVENTS_V2_COLLECTION).findOne(
        { provider: 'ASAAS', eventId },
        { projection: { _id: 1, status: 1 } },
    );
    if (!duplicate) throw new Error('WEBHOOK_DUPLICATE_NOT_FOUND');

    return {
        kind: 'duplicate',
        eventId,
        ledgerId: duplicate._id,
        status: duplicate.status,
    };
}

function claimFilter(now: Date): Document {
    return {
        $or: [
            { status: 'PENDING', nextAttemptAt: { $lte: now } },
            { status: 'FAILED', nextAttemptAt: { $lte: now }, attempts: { $lt: MAX_AUTOMATIC_ATTEMPTS } },
            { status: 'PROCESSING', leaseUntil: { $lte: now }, attempts: { $lt: MAX_AUTOMATIC_ATTEMPTS } },
        ],
    };
}

export async function claimWebhookEvent(
    db: Db,
    ledgerId?: ObjectId,
): Promise<WithId<WebhookEventV2> | null> {
    const now = new Date();
    const claimed = await db.collection<WebhookEventV2>(WEBHOOK_EVENTS_V2_COLLECTION).findOneAndUpdate(
        {
            ...(ledgerId ? { _id: ledgerId } : {}),
            ...claimFilter(now),
        },
        {
            $set: {
                status: 'PROCESSING',
                updatedAt: now,
                leaseUntil: new Date(now.getTime() + PROCESSING_LEASE_MS),
            },
            $inc: { attempts: 1 },
            $unset: { lastError: '', reviewReason: '' },
        },
        {
            returnDocument: 'after',
            sort: { receivedAt: 1, _id: 1 },
        },
    );

    return claimed;
}

export async function acquireWebhookWorkerLease(
    db: Db,
    owner: string,
    now = new Date(),
): Promise<boolean> {
    try {
        const lock = await db
            .collection<WebhookWorkerLock>(WEBHOOK_WORKER_LOCKS_COLLECTION)
            .findOneAndUpdate(
            {
                _id: WEBHOOK_WORKER_LOCK_ID,
                $or: [
                    { leaseUntil: { $lte: now } },
                    { leaseUntil: { $exists: false } },
                    { owner },
                ],
            },
            {
                $setOnInsert: { createdAt: now },
                $set: {
                    owner,
                    acquiredAt: now,
                    leaseUntil: new Date(now.getTime() + WORKER_LEASE_MS),
                    updatedAt: now,
                },
                $unset: { blockedByFailedEvent: '' },
            },
            { upsert: true, returnDocument: 'after' },
            );
        return lock?.owner === owner;
    } catch (error) {
        if ((error as { code?: number })?.code === 11000) return false;
        throw error;
    }
}

export async function releaseWebhookWorkerLease(db: Db, owner: string): Promise<void> {
    const now = new Date();
    await db.collection<WebhookWorkerLock>(WEBHOOK_WORKER_LOCKS_COLLECTION).updateOne(
        { _id: WEBHOOK_WORKER_LOCK_ID, owner },
        {
            $set: { releasedAt: now, updatedAt: now },
            $unset: { owner: '', leaseUntil: '' },
        },
    );
}

export async function holdWebhookWorkerLeaseUntil(
    db: Db,
    owner: string,
    leaseUntil: Date,
): Promise<void> {
    await db.collection<WebhookWorkerLock>(WEBHOOK_WORKER_LOCKS_COLLECTION).updateOne(
        { _id: WEBHOOK_WORKER_LOCK_ID, owner },
        {
            $set: {
                leaseUntil,
                blockedByFailedEvent: true,
                updatedAt: new Date(),
            },
        },
    );
}

export async function finishWebhookEvent(
    db: Db,
    ledgerId: ObjectId,
    status: 'PROCESSED' | 'REVIEW_REQUIRED',
    extra: Document = {},
): Promise<void> {
    const now = new Date();
    const result = await db.collection<WebhookEventV2>(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
        { _id: ledgerId, status: 'PROCESSING' },
        {
            $set: {
                status,
                updatedAt: now,
                ...(status === 'PROCESSED'
                    ? {
                        processedAt: now,
                        expiresAt: new Date(now.getTime() + PROCESSED_RETENTION_MS),
                    }
                    : {}),
                ...extra,
            },
            $unset: {
                leaseUntil: '',
                nextAttemptAt: '',
                lastError: '',
                ...(status === 'PROCESSED' ? { reviewReason: '' } : {}),
            },
        },
    );

    if (result.matchedCount !== 1) throw new Error('WEBHOOK_LEDGER_FINISH_CONFLICT');
}

export async function failWebhookEvent(
    db: Db,
    event: WithId<WebhookEventV2>,
    error: unknown,
): Promise<'FAILED' | 'REVIEW_REQUIRED'> {
    const now = new Date();
    const reachedLimit = event.attempts >= MAX_AUTOMATIC_ATTEMPTS;
    const status = reachedLimit ? 'REVIEW_REQUIRED' : 'FAILED';
    const delay = RETRY_DELAYS_MS[Math.min(Math.max(event.attempts - 1, 0), RETRY_DELAYS_MS.length - 1)];
    const lastError = error instanceof Error ? error.message.slice(0, 500) : 'unknown_error';

    const result = await db.collection<WebhookEventV2>(WEBHOOK_EVENTS_V2_COLLECTION).updateOne(
        { _id: event._id, status: 'PROCESSING' },
        {
            $set: {
                status,
                updatedAt: now,
                lastError,
                ...(reachedLimit
                    ? { reviewReason: 'MAX_AUTOMATIC_ATTEMPTS_REACHED' }
                    : { nextAttemptAt: new Date(now.getTime() + delay) }),
            },
            $unset: { leaseUntil: '' },
        },
    );

    if (result.matchedCount !== 1) throw new Error('WEBHOOK_LEDGER_FAILURE_CONFLICT');
    return status;
}
