import type { ObjectId } from 'mongodb';

export type RemoteWorkAccessStatus =
    | 'ELIGIBLE'
    | 'PAYMENT_PENDING'
    | 'ACTIVE'
    | 'REVIEW_REQUIRED'
    | 'REVOKED';

export type RemoteWorkProofReviewStatus = 'PENDING' | 'APPROVED' | 'INCONSISTENT';
export type WorkParticipationMode = 'REGULAR' | 'REMOTE';

export interface RemoteWorkProofMetadata {
    proofId: ObjectId;
    objectKey: string;
    originalName: string;
    mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
    size: number;
    sha256: string;
    uploadedAt: Date;
}

export interface RemoteWorkAccessDocument {
    _id: ObjectId;
    userId: ObjectId;
    editionId: string;
    municipalityCode: string;
    municipalityName: string;
    uf: string;
    eligibilityRuleVersion: string;
    proof: RemoteWorkProofMetadata;
    proofHistory: RemoteWorkProofMetadata[];
    proofReviewStatus: RemoteWorkProofReviewStatus;
    status: RemoteWorkAccessStatus;
    consentAcceptedAt: Date;
    purchaser?: {
        userId: ObjectId;
        name: string;
        email: string;
        cpf: string;
    };
    purchaseId?: ObjectId;
    confirmedAt?: Date;
    revokedAt?: Date;
    reviewReason?: string;
    proofReviewReason?: string;
    financialReviewStatus?: 'CLEAR' | 'REVIEW_REQUIRED';
    financialReviewReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PublicRemoteWorkAccess {
    id: string;
    editionId: string;
    municipalityCode: string;
    municipalityName: string;
    uf: string;
    status: RemoteWorkAccessStatus;
    proofReviewStatus: RemoteWorkProofReviewStatus;
    proof: {
        id: string;
        originalName: string;
        mimeType: string;
        size: number;
        uploadedAt: string;
    };
    purchaser: {
        name: string;
        email: string;
        cpf: string;
    } | null;
    purchaseId: string | null;
    confirmedAt: string | null;
    updatedAt: string;
}
