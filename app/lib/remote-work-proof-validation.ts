import { REMOTE_WORK_MAX_PROOF_BYTES } from './remote-work-access.ts';

export type RemoteProofMime = 'application/pdf' | 'image/jpeg' | 'image/png';

const MIME_BY_EXTENSION: Record<string, RemoteProofMime> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
};

export function validateRemoteProofEnvelope(input: { name: unknown; size: unknown }):
    | { ok: true; expectedMime: RemoteProofMime }
    | { ok: false; status: number; code: string; message: string } {
    const size = Number(input.size);
    if (!Number.isFinite(size) || size <= 0 || size > REMOTE_WORK_MAX_PROOF_BYTES) {
        return { ok: false, status: 413, code: 'invalid_proof_size', message: 'O comprovante deve ter no máximo 10 MiB.' };
    }
    const extension = String(input.name || '').split('.').pop()?.toLowerCase() || '';
    const expectedMime = MIME_BY_EXTENSION[extension];
    if (!expectedMime) {
        return { ok: false, status: 415, code: 'invalid_proof_extension', message: 'Envie um arquivo PDF, JPG, JPEG ou PNG.' };
    }
    return { ok: true, expectedMime };
}

export function validateRemoteProofContent(expectedMime: RemoteProofMime, detectedMime: unknown):
    | { ok: true; mimeType: RemoteProofMime }
    | { ok: false; status: number; code: string; message: string } {
    if (detectedMime !== expectedMime) {
        return {
            ok: false,
            status: 415,
            code: 'invalid_proof_type',
            message: 'O conteúdo do arquivo não corresponde à extensão PDF, JPG/JPEG ou PNG.',
        };
    }
    return { ok: true, mimeType: expectedMime };
}
