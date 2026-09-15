import type { Db, Document, ObjectId } from 'mongodb';
import type {
    PublicRemoteWorkAccess,
    RemoteWorkAccessDocument,
} from '@/lib/types/remote-work-access';

export const REMOTE_WORK_ACCESS_COLLECTION = 'trabalhos_acessos_remotos';
export const REMOTE_WORK_SUBMISSION_LOCKS_COLLECTION = 'trabalhos_submission_locks';
export const REMOTE_WORK_PRODUCT_TYPE = 'remote-work-access' as const;
export const REMOTE_WORK_PRICE_CENTS = 6_000;
export const REMOTE_WORK_ELIGIBILITY_RULE_VERSION = 'cieps-2026-city-denylist-v1';
export const REMOTE_WORK_MAX_PROOF_BYTES = 10 * 1024 * 1024;

export function remoteWorkActiveKey(editionId: string, userId: string): string {
    return `${editionId}:${userId}:${REMOTE_WORK_PRODUCT_TYPE}`;
}

export function normalizePaymentProductType(value: unknown): string {
    const normalized = String(value ?? '').trim();
    return normalized || 'ticket';
}

export type BrazilianMunicipality = {
    code: string;
    name: string;
    uf: string;
};

const BLOCKED_MUNICIPALITIES = [
    ['3103504', 'MG', 'Araguari'],
    ['3170206', 'MG', 'Uberlândia'],
    ['3169604', 'MG', 'Tupaciguara'],
    ['3145000', 'MG', 'Nova Ponte'],
    ['3143104', 'MG', 'Monte Carmelo'],
    ['3157708', 'MG', 'Santa Juliana'],
    ['3149804', 'MG', 'Perdizes'],
    ['3148103', 'MG', 'Patrocínio'],
    ['3119302', 'MG', 'Coromandel'],
    ['3115805', 'MG', 'Centralina'],
    ['3111804', 'MG', 'Canápolis'],
    ['3142809', 'MG', 'Monte Alegre de Minas'],
    ['3152808', 'MG', 'Prata'],
    ['3170107', 'MG', 'Uberaba'],
    ['5205109', 'GO', 'Catalão'],
    ['5210109', 'GO', 'Ipameri'],
    ['5204508', 'GO', 'Caldas Novas'],
    ['5213806', 'GO', 'Morrinhos'],
    ['5203906', 'GO', 'Buriti Alegre'],
    ['5211503', 'GO', 'Itumbiara'],
] as const;

export function normalizeMunicipalityName(value: unknown): string {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleUpperCase('pt-BR');
}

export function municipalityEligibilityKey(uf: unknown, name: unknown): string {
    return `${String(uf ?? '').trim().toUpperCase()}:${normalizeMunicipalityName(name)}`;
}

const BLOCKED_KEYS = new Set(
    BLOCKED_MUNICIPALITIES.map(([, uf, name]) => municipalityEligibilityKey(uf, name)),
);
const BLOCKED_CODES = new Set<string>(BLOCKED_MUNICIPALITIES.map(([code]) => code));

export function isRemoteMunicipalityBlocked(
    municipality: Pick<BrazilianMunicipality, 'name' | 'uf'> & Partial<Pick<BrazilianMunicipality, 'code'>>,
): boolean {
    const code = String(municipality.code ?? '').replace(/\D/g, '');
    if (/^\d{7}$/.test(code)) return BLOCKED_CODES.has(code);
    return BLOCKED_KEYS.has(municipalityEligibilityKey(municipality.uf, municipality.name));
}

export function municipalityMatchesUf(
    municipality: Pick<BrazilianMunicipality, 'uf'>,
    submittedUf: unknown,
): boolean {
    const uf = String(submittedUf ?? '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(uf) && municipality.uf === uf;
}

export function validateRemoteMunicipality(municipality: BrazilianMunicipality):
    | { ok: true; value: BrazilianMunicipality }
    | { ok: false; code: string; message: string } {
    const value = {
        code: String(municipality.code ?? '').replace(/\D/g, ''),
        name: String(municipality.name ?? '').trim(),
        uf: String(municipality.uf ?? '').trim().toUpperCase(),
    };

    if (!/^\d{7}$/.test(value.code) || !value.name || !/^[A-Z]{2}$/.test(value.uf)) {
        return {
            ok: false,
            code: 'invalid_municipality',
            message: 'Selecione um município brasileiro válido.',
        };
    }
    if (isRemoteMunicipalityBlocked(value)) {
        return {
            ok: false,
            code: 'remote_participation_not_available_for_city',
            message: 'A apresentação remota não está disponível para o município selecionado.',
        };
    }
    return { ok: true, value };
}

function municipalityUf(payload: Record<string, any>): string {
    return String(
        payload?.microrregiao?.mesorregiao?.UF?.sigla ||
        payload?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ||
        '',
    ).trim().toUpperCase();
}

export async function resolveBrazilianMunicipality(
    code: unknown,
    fetchImpl: typeof fetch = fetch,
): Promise<BrazilianMunicipality | null> {
    const normalizedCode = String(code ?? '').replace(/\D/g, '');
    if (!/^\d{7}$/.test(normalizedCode)) return null;

    const response = await fetchImpl(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${normalizedCode}`,
        { cache: 'force-cache', next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return null;
    const payload = await response.json() as Record<string, any>;
    const name = String(payload?.nome || '').trim();
    const uf = municipalityUf(payload);
    if (!name || !/^[A-Z]{2}$/.test(uf)) return null;
    return { code: normalizedCode, name, uf };
}

export function toPublicRemoteWorkAccess(
    access: RemoteWorkAccessDocument | Document | null,
): PublicRemoteWorkAccess | null {
    if (!access?._id || !access?.proof?.proofId) return null;
    const iso = (value: unknown): string | null => {
        const date = value instanceof Date ? value : new Date(String(value || ''));
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };
    return {
        id: String(access._id),
        editionId: String(access.editionId || ''),
        municipalityCode: String(access.municipalityCode || ''),
        municipalityName: String(access.municipalityName || ''),
        uf: String(access.uf || ''),
        status: access.status,
        proofReviewStatus: access.proofReviewStatus,
        proof: {
            id: String(access.proof.proofId),
            originalName: String(access.proof.originalName || ''),
            mimeType: String(access.proof.mimeType || ''),
            size: Number(access.proof.size || 0),
            uploadedAt: iso(access.proof.uploadedAt) || new Date(0).toISOString(),
        },
        purchaser: access.purchaser
            ? {
                name: String(access.purchaser.name || ''),
                email: String(access.purchaser.email || ''),
                cpf: String(access.purchaser.cpf || ''),
            }
            : null,
        purchaseId: access.purchaseId ? String(access.purchaseId) : null,
        confirmedAt: iso(access.confirmedAt),
        updatedAt: iso(access.updatedAt) || new Date(0).toISOString(),
    };
}

export async function findRemoteWorkAccess(
    db: Db,
    userId: ObjectId,
    editionId: string,
    options: { activeOnly?: boolean } = {},
): Promise<RemoteWorkAccessDocument | null> {
    return db.collection<RemoteWorkAccessDocument>(REMOTE_WORK_ACCESS_COLLECTION).findOne({
        userId,
        editionId,
        ...(options.activeOnly
            ? { status: 'ACTIVE', proofReviewStatus: { $ne: 'INCONSISTENT' } }
            : {}),
    });
}

export function isRemoteWorkSession(session: { type?: unknown } | null | undefined): boolean {
    return session?.type === REMOTE_WORK_PRODUCT_TYPE;
}
