import type { IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import type { WorkParticipationMode } from '@/lib/types/remote-work-access';

type Modality = NonNullable<IAcademicWorksProps['modalidades']>[number];
type AuthorInput = { nome?: unknown; email?: unknown; cpf?: unknown; isOrientador?: unknown };

export function normalizeParticipationMode(value: unknown): WorkParticipationMode {
    return value === 'REMOTE' ? 'REMOTE' : 'REGULAR';
}

export function normalizeAuthorEmail(value: unknown): string {
    return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

export function validateAcademicWorkAuthors(
    authors: AuthorInput[],
    modality: Pick<Modality, 'autores_por_trabalho' | 'maximo_orientadores'>,
): { ok: true } | { ok: false; message: string } {
    if (!Array.isArray(authors) || authors.length === 0) return { ok: false, message: 'Informe ao menos um autor.' };
    if (authors.some((author) => !String(author.nome || '').trim() || !normalizeAuthorEmail(author.email) || !String(author.cpf || '').replace(/\D/g, ''))) {
        return { ok: false, message: 'Preencha nome, e-mail e CPF de todos os autores e orientadores.' };
    }
    const advisors = authors.filter((author) => author.isOrientador === true).length;
    const regularAuthors = authors.length - advisors;
    if (regularAuthors < 1) return { ok: false, message: 'Informe ao menos um autor que não seja orientador.' };
    if (advisors < 1) return { ok: false, message: 'Informe ao menos um orientador.' };
    if (regularAuthors > Number(modality.autores_por_trabalho)) {
        return { ok: false, message: `A modalidade permite no máximo ${modality.autores_por_trabalho} autor(es), sem contar orientadores.` };
    }
    if (advisors > Number(modality.maximo_orientadores)) {
        return { ok: false, message: `A modalidade permite no máximo ${modality.maximo_orientadores} orientador(es).` };
    }
    return { ok: true };
}

export function purchaserIsRemoteAuthor(authors: AuthorInput[], authenticatedEmail: unknown): boolean {
    const email = normalizeAuthorEmail(authenticatedEmail);
    return Boolean(email && authors.some(
        (author) => author.isOrientador !== true && normalizeAuthorEmail(author.email) === email,
    ));
}

export function validateAcademicWorkLimits(input: {
    totalCount: number;
    modalityCount: number;
    globalLimit: unknown;
    modalityLimit: unknown;
}):
    | { ok: true }
    | { ok: false; code: 'global_work_limit_reached' | 'modality_work_limit_reached'; message: string } {
    const globalLimit = Number(input.globalLimit);
    const modalityLimit = Number(input.modalityLimit);
    if (!Number.isInteger(globalLimit) || globalLimit < 1 || input.totalCount >= globalLimit) {
        return {
            ok: false,
            code: 'global_work_limit_reached',
            message: `Você atingiu o limite global de ${globalLimit || 0} trabalho(s).`,
        };
    }
    if (!Number.isInteger(modalityLimit) || modalityLimit < 1 || input.modalityCount >= modalityLimit) {
        return {
            ok: false,
            code: 'modality_work_limit_reached',
            message: `Você atingiu o limite de ${modalityLimit || 0} trabalho(s) nesta modalidade.`,
        };
    }
    return { ok: true };
}
