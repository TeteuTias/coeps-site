// Confirmação automática de recebimento de trabalho.
// O e-mail é enviado pelo Google Apps Script da Comissão Científica, que também
// guarda o liga/desliga controlado pelo Admin: aqui apenas avisamos a submissão.

const SCRIPT_URL_PREFIX = 'https://script.google.com/';
const SCRIPT_TIMEOUT_MS = 10_000;

export interface WorkReceiptInput {
    titulo: unknown;
    autores: unknown;
    remetenteEmail: unknown;
}

export interface WorkReceiptPayload {
    titulo: string;
    autores: string[];
    destinatarios: string[];
}

function text(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

export function buildWorkReceiptPayload(work: WorkReceiptInput): WorkReceiptPayload | null {
    const autores = Array.isArray(work.autores)
        ? work.autores.filter((autor): autor is Record<string, unknown> => typeof autor === 'object' && autor !== null)
        : [];
    const titulo = text(work.titulo);
    const destinatarios = Array.from(new Set(
        [work.remetenteEmail, ...autores.map(autor => autor.email)]
            .map(email => text(email).toLowerCase())
            .filter(email => email.includes('@')),
    ));
    if (!titulo || destinatarios.length === 0) return null;

    return {
        titulo,
        autores: Array.from(new Set(autores.map(autor => text(autor.nome)).filter(Boolean))),
        destinatarios,
    };
}

// Nunca lança: uma falha no aviso não pode afetar a submissão já gravada.
export async function notifyWorkReceipt(work: WorkReceiptInput): Promise<void> {
    const url = (process.env.GOOGLE_SCRIPT_EMAIL_URL ?? '').trim();
    const secret = (process.env.GOOGLE_SCRIPT_EMAIL_SECRET ?? '').trim();
    if (!url.startsWith(SCRIPT_URL_PREFIX) || !secret) return;

    const trabalho = buildWorkReceiptPayload(work);
    if (!trabalho) return;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret, acao: 'confirmacao', trabalho }),
            redirect: 'follow',
            cache: 'no-store',
            signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
        });
        const result = await response.json() as { ok?: unknown; erro?: unknown };
        if (result?.ok !== true) {
            console.error('Confirmação de recebimento recusada pelo script:', result?.erro);
        }
    } catch (error) {
        console.error('Falha ao solicitar a confirmação de recebimento:', error);
    }
}
