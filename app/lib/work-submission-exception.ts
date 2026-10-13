import type { WorkFileConfig } from './academic-work-files';

const DURATION_MS = 24 * 60 * 60 * 1000;

/** Server-only configuration. Never import this module in a client component. */
export function getWorkSubmissionException(
    userId: string,
    editionId: string,
    config: WorkFileConfig,
    now = new Date(),
) {
    try {
        const value = JSON.parse(process.env.WORK_SUBMISSION_EXCEPTION || 'null');
        if (!value || typeof value.userId !== 'string' || !/^[a-f0-9]{24}$/.test(value.userId)
            || value.userId !== userId || !editionId || value.editionId !== editionId
            || typeof value.activatedAt !== 'string'
            || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.activatedAt)) {
            return null;
        }
        const activatedAt = new Date(value.activatedAt);
        const expiresAt = new Date(activatedAt.getTime() + DURATION_MS);
        const deadline = new Date(config.data_limite_submissao ?? '').getTime();
        // Only a late first submission; never open an edition before its deadline.
        if (!(now.getTime() > deadline && activatedAt.getTime() <= now.getTime()
            && now.getTime() < expiresAt.getTime())) return null;
        return { activatedAt, expiresAt };
    } catch {
        // Missing or malformed configuration must keep submissions closed.
        return null;
    }
}
