export type WorkFileRequirement = { titulo: string; formatos: string[] };

// Reserva margem para o multipart abaixo do limite de 4,5 MB da Vercel.
export const MAX_WORK_UPLOAD_PART_BYTES = 4 * 1024 * 1024;
const DEFAULT_WORK_UPLOAD_CHUNK_BYTES = 2.5 * 1024 * 1024;

export function workUploadLimits(config?: { chunk_limite?: unknown; chunk_tamanho?: unknown }) {
    const safeBytes = (value: unknown, fallback: number): number =>
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
            ? Math.min(value, MAX_WORK_UPLOAD_PART_BYTES)
            : fallback;

    return {
        chunkThreshold: safeBytes(config?.chunk_limite, MAX_WORK_UPLOAD_PART_BYTES),
        chunkSize: safeBytes(config?.chunk_tamanho, DEFAULT_WORK_UPLOAD_CHUNK_BYTES),
    };
}

export type WorkFileConfig = {
    isOpen?: boolean;
    data_inicio_submissao?: string;
    data_limite_submissao?: string;
};

export const WORK_FILE_MIME: Record<string, string[]> = {
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword', 'application/x-ole-storage', 'application/x-cfb'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

export function workFileExtension(name: string): string {
    const match = /\.[^.\\/]+$/.exec(name.trim());
    return match?.[0].toLowerCase() ?? '';
}

// Lê os nomes no diretório central do ZIP (fim do arquivo), onde os tamanhos são sempre reais.
// shortcut: não suporta ZIP64; um DOCX ZIP64 continua recusado até alguém precisar disso.
function zipEntryNames(bytes: Uint8Array): Set<string> {
    const names = new Set<string>();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const lowest = Math.max(0, bytes.length - 22 - 0xffff);
    for (let end = bytes.length - 22; end >= lowest; end--) {
        if (view.getUint32(end, true) !== 0x06054b50) continue;
        let remaining = view.getUint16(end + 10, true);
        let position = view.getUint32(end + 16, true);
        while (remaining-- > 0 && position + 46 <= bytes.length && view.getUint32(position, true) === 0x02014b50) {
            const nameEnd = position + 46 + view.getUint16(position + 28, true);
            if (nameEnd > bytes.length) break;
            names.add(new TextDecoder().decode(bytes.subarray(position + 46, nameEnd)));
            position = nameEnd + view.getUint16(position + 30, true) + view.getUint16(position + 32, true);
        }
        break;
    }
    return names;
}

// A file-type desiste de DOCX com data descriptor e mais de 1 MiB antes do [Content_Types].xml
// e responde application/zip. Nesse caso confirma o pacote Word pelo diretório central.
export function workFileMime(name: string, bytes: Uint8Array, detectedMime?: string): string | undefined {
    if (detectedMime !== 'application/zip' || workFileExtension(name) !== '.docx') return detectedMime;
    const names = zipEntryNames(bytes);
    return names.has('[Content_Types].xml') && names.has('word/document.xml')
        ? WORK_FILE_MIME['.docx'][0]
        : detectedMime;
}

export function normalizedWorkFileFormats(formats: unknown): string[] {
    if (!Array.isArray(formats)) return [];
    return Array.from(new Set(formats.map((value) => String(value ?? '').trim().toLowerCase())
        .filter(Boolean).map((value) => value.startsWith('.') ? value : `.${value}`)));
}

export function workSubmissionIsOpen(config: WorkFileConfig, now = new Date()): boolean {
    const start = new Date(config.data_inicio_submissao ?? '').getTime();
    const end = new Date(config.data_limite_submissao ?? '').getTime();
    return config.isOpen === true && Number.isFinite(start) && Number.isFinite(end)
        && start <= now.getTime() && now.getTime() <= end;
}

export function validateWorkFile(
    file: { name: string; size: number; contentType?: string },
    requirement: WorkFileRequirement,
    maxBytes: number,
): string | null {
    const formats = normalizedWorkFileFormats(requirement.formatos);
    const extension = workFileExtension(file.name);
    if (!formats.includes(extension)) {
        return `Formato inválido para ${requirement.titulo}. Envie ${formats.join(' ou ')}.`;
    }
    if (!Number.isFinite(file.size) || file.size <= 0) return 'O arquivo está vazio ou tem tamanho inválido.';
    if (!Number.isFinite(maxBytes) || maxBytes <= 0 || file.size > maxBytes) {
        return `O arquivo excede o limite de ${(maxBytes / 1024 / 1024).toLocaleString('pt-BR')} MiB.`;
    }
    if (file.contentType && !WORK_FILE_MIME[extension]?.includes(file.contentType)) {
        return `O conteúdo de ${file.name} não corresponde ao formato ${extension}.`;
    }
    return null;
}

export function validateWorkFileSlots(
    slots: Array<{ slotIndex: number; fileId: string }>,
    requirements: WorkFileRequirement[],
): string | null {
    if (!Array.isArray(requirements) || requirements.length === 0) return 'Requisitos de arquivos indisponíveis.';
    if (!Array.isArray(slots) || slots.length !== requirements.length) {
        return `Envie um arquivo para cada um dos ${requirements.length} requisitos.`;
    }
    const indexes = new Set<number>();
    const ids = new Set<string>();
    for (const slot of slots) {
        if (!Number.isInteger(slot?.slotIndex) || slot.slotIndex < 0 || slot.slotIndex >= requirements.length
            || typeof slot.fileId !== 'string' || !slot.fileId.trim()
            || indexes.has(slot.slotIndex) || ids.has(slot.fileId)) {
            return 'A lista de arquivos contém requisitos ou IDs inválidos ou repetidos.';
        }
        indexes.add(slot.slotIndex);
        ids.add(slot.fileId);
    }
    return null;
}
