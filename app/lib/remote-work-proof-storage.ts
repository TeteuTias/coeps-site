import {
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectId } from 'mongodb';

type RemoteProofMime = 'application/pdf' | 'image/jpeg' | 'image/png';

function r2Client() {
    const endpoint = process.env.r2_endpoint_url;
    const accessKeyId = process.env.r2_access_key;
    const secretAccessKey = process.env.r2_secret_key;
    const bucket = process.env.r2_bucket_name;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
        throw new Error('REMOTE_PROOF_STORAGE_NOT_CONFIGURED');
    }
    return {
        bucket,
        client: new S3Client({
            endpoint,
            region: 'auto',
            credentials: { accessKeyId, secretAccessKey },
        }),
    };
}

function extensionForMime(mimeType: RemoteProofMime): string {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'image/png') return 'png';
    return 'jpg';
}

export async function uploadRemoteWorkProof(input: {
    userId: ObjectId;
    editionId: string;
    proofId: ObjectId;
    body: Buffer;
    mimeType: RemoteProofMime;
}): Promise<string> {
    const { client, bucket } = r2Client();
    const safeEdition = input.editionId.replace(/[^A-Za-z0-9_-]/g, '_');
    const objectKey = [
        'remote-work-proofs',
        safeEdition,
        input.userId.toHexString(),
        `${input.proofId.toHexString()}.${extensionForMime(input.mimeType)}`,
    ].join('/');
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.mimeType,
        CacheControl: 'private, no-store',
        Metadata: {
            owner: input.userId.toHexString(),
            edition: safeEdition,
        },
    }));
    return objectKey;
}

export async function deleteRemoteWorkProof(objectKey: string): Promise<void> {
    const { client, bucket } = r2Client();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}
