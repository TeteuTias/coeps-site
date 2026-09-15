import type { ClientSession, Db, Document } from 'mongodb';
import {
    isRemoteWorkSession,
    REMOTE_WORK_ACCESS_COLLECTION,
} from '@/lib/remote-work-access';

export async function markProductPaymentPending(
    db: Db,
    paymentSession: Document,
    mongoSession: ClientSession,
): Promise<void> {
    if (isRemoteWorkSession(paymentSession)) {
        const result = await db.collection(REMOTE_WORK_ACCESS_COLLECTION).updateOne(
            {
                _id: paymentSession.remoteAccessId,
                userId: paymentSession.owner,
                purchaseId: paymentSession._id,
                status: { $in: ['ELIGIBLE', 'PAYMENT_PENDING'] },
            },
            { $set: { status: 'PAYMENT_PENDING', updatedAt: new Date() } },
            { session: mongoSession },
        );
        if (result.matchedCount !== 1) throw new Error('REMOTE_ACCESS_PAYMENT_UPDATE_FAILED');
        return;
    }

    const result = await db.collection('usuarios').updateOne(
        { _id: paymentSession.owner, 'pagamento.situacao': { $ne: 1 } },
        { $set: { 'pagamento.situacao': 2 } },
        { session: mongoSession },
    );
    if (result.matchedCount !== 1) throw new Error('PAYMENT_SESSION_OWNER_UPDATE_FAILED');
}

export async function activateRemoteWorkAccess(
    db: Db,
    paymentSession: Document,
    now: Date,
    mongoSession: ClientSession,
): Promise<void> {
    if (!isRemoteWorkSession(paymentSession)) return;
    const result = await db.collection(REMOTE_WORK_ACCESS_COLLECTION).updateOne(
        {
            _id: paymentSession.remoteAccessId,
            userId: paymentSession.owner,
            purchaseId: paymentSession._id,
            proofReviewStatus: { $ne: 'INCONSISTENT' },
        },
        {
            $set: {
                status: 'ACTIVE',
                confirmedAt: now,
                financialReviewStatus: 'CLEAR',
                updatedAt: now,
            },
            $unset: {
                revokedAt: '',
                reviewReason: '',
                financialReviewReason: '',
            },
        },
        { session: mongoSession },
    );
    if (result.matchedCount !== 1) throw new Error('REMOTE_ACCESS_ACTIVATION_FAILED');
}

export async function releaseRemoteWorkAccessPayment(
    db: Db,
    paymentSession: Document,
    now: Date,
    mongoSession: ClientSession,
): Promise<void> {
    if (!isRemoteWorkSession(paymentSession)) return;
    await db.collection(REMOTE_WORK_ACCESS_COLLECTION).updateOne(
        { _id: paymentSession.remoteAccessId, userId: paymentSession.owner, purchaseId: paymentSession._id },
        {
            $set: { status: 'ELIGIBLE', updatedAt: now },
            $unset: {
                purchaseId: '',
                confirmedAt: '',
                revokedAt: '',
                reviewReason: '',
                financialReviewStatus: '',
                financialReviewReason: '',
            },
        },
        { session: mongoSession },
    );
}

export async function flagRemoteWorksForFinancialReview(
    db: Db,
    paymentSession: Document,
    reason: string,
    now: Date,
    mongoSession: ClientSession,
): Promise<void> {
    if (!isRemoteWorkSession(paymentSession)) return;
    await Promise.all([
        db.collection(REMOTE_WORK_ACCESS_COLLECTION).updateOne(
            { _id: paymentSession.remoteAccessId, userId: paymentSession.owner },
            {
                $set: {
                    status: 'REVIEW_REQUIRED',
                    reviewReason: reason,
                    financialReviewStatus: 'REVIEW_REQUIRED',
                    financialReviewReason: reason,
                    revokedAt: now,
                    updatedAt: now,
                },
            },
            { session: mongoSession },
        ),
        db.collection('Dados_do_trabalho').updateMany(
            { remoteAccessId: paymentSession.remoteAccessId, participationMode: 'REMOTE' },
            {
                $set: {
                    financialReviewStatus: 'REVIEW_REQUIRED',
                    financialReviewReason: reason,
                    financialReviewUpdatedAt: now,
                },
            },
            { session: mongoSession },
        ),
    ]);
}
