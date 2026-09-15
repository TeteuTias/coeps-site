import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { getActivePaymentConfig, getEditionId } from '@/lib/payments/config';
import { hasConfirmedRegistrationForEdition } from '@/lib/payments/codes';
import {
    REMOTE_WORK_ACCESS_COLLECTION,
    REMOTE_WORK_ELIGIBILITY_RULE_VERSION,
    municipalityMatchesUf,
    resolveBrazilianMunicipality,
    toPublicRemoteWorkAccess,
    validateRemoteMunicipality,
} from '@/lib/remote-work-access';
import { deleteRemoteWorkProof, uploadRemoteWorkProof } from '@/lib/remote-work-proof-storage';
import {
    validateRemoteProofContent,
    validateRemoteProofEnvelope,
} from '@/lib/remote-work-proof-validation';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    const session = await getSession(request);
    const userId = String(session?.user?.sub || '').replace(/^auth0\|/, '');
    if (!ObjectId.isValid(userId)) {
        return NextResponse.json({ error: 'not_authenticated', message: 'Sessão inválida.' }, { status: 401 });
    }

    let uploadedObjectKey: string | null = null;
    try {
        const form = await request.formData();
        const file = form.get('file');
        const municipalityCode = form.get('municipalityCode');
        const submittedUf = form.get('uf');
        if (!(file instanceof File) || form.get('consentAccepted') !== 'true') {
            return NextResponse.json(
                { error: 'invalid_remote_access_data', message: 'Envie o comprovante e aceite os termos de privacidade.' },
                { status: 400 },
            );
        }
        const envelope = validateRemoteProofEnvelope({ name: file.name, size: file.size });
        if (envelope.ok === false) {
            return NextResponse.json(
                { error: envelope.code, message: envelope.message },
                { status: envelope.status },
            );
        }
        const municipality = await resolveBrazilianMunicipality(municipalityCode);
        if (!municipality) {
            return NextResponse.json(
                { error: 'invalid_municipality', message: 'Não foi possível validar o município informado.' },
                { status: 422 },
            );
        }
        if (!municipalityMatchesUf(municipality, submittedUf)) {
            return NextResponse.json(
                { error: 'invalid_municipality_uf_pair', message: 'O município não pertence à UF informada.' },
                { status: 422 },
            );
        }
        const eligibility = validateRemoteMunicipality(municipality);
        if (eligibility.ok === false) {
            return NextResponse.json(
                { error: eligibility.code, message: eligibility.message },
                { status: eligibility.code === 'invalid_municipality' ? 422 : 403 },
            );
        }

        const body = Buffer.from(await file.arrayBuffer());
        const detected = await fileTypeFromBuffer(body);
        const content = validateRemoteProofContent(envelope.expectedMime, detected?.mime);
        if (content.ok === false) {
            return NextResponse.json(
                { error: content.code, message: content.message },
                { status: content.status },
            );
        }
        const mimeType = content.mimeType;
        const { db } = await connectToDatabase();
        const config = await getActivePaymentConfig(db);
        if (!config) {
            return NextResponse.json({ error: 'payment_config_not_found', message: 'Configuração não encontrada.' }, { status: 404 });
        }
        const owner = new ObjectId(userId);
        const editionId = getEditionId(config);
        if (await hasConfirmedRegistrationForEdition(db, owner, editionId)) {
            return NextResponse.json(
                { error: 'regular_registration_already_confirmed', message: 'Sua inscrição regular já permite enviar trabalhos.' },
                { status: 409 },
            );
        }
        const existing = await db.collection(REMOTE_WORK_ACCESS_COLLECTION).findOne({ userId: owner, editionId });
        if (existing && existing.status !== 'ELIGIBLE') {
            return NextResponse.json(
                {
                    error: existing.status === 'ACTIVE'
                        ? 'remote_access_already_active'
                        : 'remote_proof_locked',
                    message: existing.status === 'ACTIVE'
                        ? 'Seu acesso remoto já está confirmado.'
                        : 'O comprovante não pode ser substituído durante ou após o processamento financeiro.',
                },
                { status: 409 },
            );
        }

        const now = new Date();
        const proofId = new ObjectId();
        uploadedObjectKey = await uploadRemoteWorkProof({ userId: owner, editionId, proofId, body, mimeType });
        const proof = {
            proofId,
            objectKey: uploadedObjectKey,
            originalName: file.name.slice(0, 255),
            mimeType,
            size: file.size,
            sha256: createHash('sha256').update(body).digest('hex'),
            uploadedAt: now,
        };
        await db.collection(REMOTE_WORK_ACCESS_COLLECTION).updateOne(
            { userId: owner, editionId, status: { $ne: 'ACTIVE' } },
            {
                $setOnInsert: { _id: new ObjectId(), userId: owner, editionId, createdAt: now },
                $set: {
                    municipalityCode: municipality.code,
                    municipalityName: municipality.name,
                    uf: municipality.uf,
                    eligibilityRuleVersion: REMOTE_WORK_ELIGIBILITY_RULE_VERSION,
                    proof,
                    proofReviewStatus: 'PENDING',
                    status: 'ELIGIBLE',
                    consentAcceptedAt: now,
                    updatedAt: now,
                },
                $push: { proofHistory: proof },
                $unset: { purchaseId: '', confirmedAt: '', revokedAt: '', reviewReason: '' },
            },
            { upsert: true },
        );
        const access = await db.collection(REMOTE_WORK_ACCESS_COLLECTION).findOne({ userId: owner, editionId });
        return NextResponse.json({ success: true, access: toPublicRemoteWorkAccess(access) }, { status: 201 });
    } catch (error) {
        if (uploadedObjectKey) await deleteRemoteWorkProof(uploadedObjectKey).catch(() => undefined);
        console.error('Falha ao salvar comprovante remoto:', error);
        return NextResponse.json(
            { error: 'remote_proof_upload_failed', message: 'Não foi possível salvar o comprovante.' },
            { status: 500 },
        );
    }
});
