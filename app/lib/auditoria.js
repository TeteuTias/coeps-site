// Registro de auditoria do site, na MESMA coleção que a aba Logs do Admin lê (logs_auditoria).
// Grava inscrições e cancelamentos feitos pelo congressista, PIX de atividade, webhooks do Asaas e a
// liberação automática de vaga. Só insere: nada no site altera ou apaga um log já gravado.
// Falha ao gravar log nunca derruba a ação (vai para o console da Vercel com o conteúdo).

import { ObjectId } from 'mongodb';

export const COLECAO_LOGS = 'logs_auditoria';

const CHAVE_SENSIVEL = /(cpf|senha|password|passwd|token|secret|segredo|authorization|cookie|card|cartao|cartão|cvv|ccv|creditcard|holder|api[_-]?key|access_token|pixQrCode|payload)/i;

/** Cópia segura: sem CPF, tokens, cartão nem QR do PIX; textos e listas cortados. */
export function sanitizar(valor, profundidade = 0) {
    if (valor == null || typeof valor !== 'object') {
        return typeof valor === 'string' && valor.length > 2000 ? `${valor.slice(0, 2000)}…` : valor;
    }
    if (valor instanceof Date) return valor;
    if (typeof valor.toHexString === 'function') return valor.toHexString();
    if (profundidade >= 5) return '[…]';
    if (Array.isArray(valor)) return valor.slice(0, 200).map((v) => sanitizar(v, profundidade + 1));
    const saida = {};
    for (const [chave, v] of Object.entries(valor)) {
        if (chave.startsWith('$')) continue;
        saida[chave] = CHAVE_SENSIVEL.test(chave) ? '[oculto]' : sanitizar(v, profundidade + 1);
    }
    return saida;
}

export function origemDoPedido(request) {
    const headers = request?.headers;
    if (!headers || typeof headers.get !== 'function') return null;
    const encaminhado = headers.get('x-forwarded-for');
    return {
        ip: encaminhado ? encaminhado.split(',')[0].trim() : headers.get('x-real-ip'),
        userAgent: headers.get('user-agent'),
        rota: (() => { try { return new URL(request.url).pathname; } catch { return null; } })(),
        metodo: request.method || null,
    };
}

export function atorCongressista(userId) {
    return { tipo: 'congressista', id: userId ? String(userId) : null, conta: null, email: null, nome: null };
}

export const ATOR_ASAAS = { tipo: 'asaas', id: null, conta: 'Asaas', email: null, nome: null };
export const ATOR_SISTEMA = { tipo: 'sistema', id: null, conta: 'Liberação automática', email: null, nome: null };

/**
 * @typedef {object} DadosLog
 * @property {'site'|'webhook'|'sistema'|'admin'} origem
 * @property {string} acao
 * @property {string} categoria
 * @property {string} resumo
 * @property {boolean} [sucesso]
 * @property {Record<string, unknown>} ator
 * @property {Record<string, unknown>} [alvo]
 * @property {unknown} [antes]
 * @property {unknown} [depois]
 * @property {unknown} [detalhes]
 * @property {{ metodo?: string|null, rota?: string|null, ip?: string|null, userAgent?: string|null } | null} [requisicao]
 * @property {Date} [em]
 * @property {string} [chave]
 */

/** Monta o documento (puro, testável).
 * @param {DadosLog} dados
 */
export function montarLog({ origem, acao, categoria, resumo, sucesso = true, ator, alvo = {}, antes, depois, detalhes, requisicao, em = new Date(), chave }) {
    const doc = {
        em,
        origem,
        acao,
        categoria,
        resumo,
        sucesso,
        status: null,
        ator,
        alvo: Object.fromEntries(Object.entries(alvo).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])),
    };
    if (chave) doc._id = chave;
    if (antes !== undefined) doc.antes = sanitizar(antes);
    if (depois !== undefined) doc.depois = sanitizar(depois);
    if (detalhes !== undefined) doc.detalhes = sanitizar(detalhes);
    if (requisicao) doc.requisicao = { metodo: requisicao.metodo ?? null, rota: requisicao.rota ?? null, ip: requisicao.ip ?? null, userAgent: requisicao.userAgent ?? null };
    return doc;
}

async function completarNomes(db, alvo) {
    const hex = /^[0-9a-f]{24}$/i;
    const saida = { ...alvo };
    try {
        const [usuario, minicurso] = await Promise.all([
            saida.usuarioId && !saida.usuarioNome && hex.test(saida.usuarioId)
                ? db.collection('usuarios').findOne({ _id: new ObjectId(saida.usuarioId) }, { projection: { 'informacoes_usuario.nome': 1 } })
                : null,
            saida.minicursoId && !saida.minicursoNome && hex.test(saida.minicursoId)
                ? db.collection('minicursos').findOne({ _id: new ObjectId(saida.minicursoId) }, { projection: { name: 1 } })
                : null,
        ]);
        if (usuario?.informacoes_usuario?.nome) saida.usuarioNome = String(usuario.informacoes_usuario.nome);
        if (minicurso?.name) saida.minicursoNome = String(minicurso.name);
    } catch {
        // nome é só conveniência
    }
    return saida;
}

/**
 * Grava um log. Com `chave`, grava uma vez só (repetir o mesmo evento, ou a transação repetir, não duplica).
 * Grava FORA da transação de propósito: um erro no log não pode desfazer pagamento nem inscrição.
 */
/**
 * @param {any} db
 * @param {DadosLog} dados
 */
export async function registrarLog(db, dados) {
    const doc = montarLog(dados);
    try {
        doc.alvo = await completarNomes(db, doc.alvo);
        if (doc._id) {
            await db.collection(COLECAO_LOGS).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
        } else {
            await db.collection(COLECAO_LOGS).insertOne(doc);
        }
        return true;
    } catch (error) {
        console.error('auditoria: log NÃO gravado', JSON.stringify({ acao: doc.acao, alvo: doc.alvo, em: doc.em }), error);
        return false;
    }
}
