// Cobranças de minicurso pago que ficaram abertas no Asaas depois que a pessoa foi tirada da atividade.
// Antes da correção no Admin, remover a inscrição não cancelava a cobrança: se a pessoa pagasse,
// o webhook a reinscrevia.
//
// Uso (variáveis MONGODB_URI, ASAAS_API_URL e ASAAS_API_KEY no ambiente):
//   node scripts/payments/cancel-orphan-activity-charges.mjs --asaas=producao
//     Só leitura: lê usuarios e minicursos, consulta cada cobrança suspeita no Asaas (GET) e lista.
//   node scripts/payments/cancel-orphan-activity-charges.mjs --asaas=producao --apply
//     Exclui no Asaas (DELETE) só as linhas "cancelar", reconsultando cada uma antes.
//     Não escreve no banco: o webhook PAYMENT_DELETED do site tira a cobrança de lista_pagamentos.
// --asaas=producao|sandbox precisa bater com ASAAS_API_URL, para não rodar no Asaas errado.
// A saída não tem nome, CPF nem e-mail: só ids, atividade, valor e status.
import { MongoClient } from 'mongodb';
import { classify, findCandidates, OPEN_STATUSES } from './orphan-activity-charges.mjs';

const databaseName = 'coeps2026';
const apply = process.argv.includes('--apply');
const asaasArg = process.argv.find((arg) => arg.startsWith('--asaas='))?.split('=')[1];

const { MONGODB_URI, ASAAS_API_URL, ASAAS_API_KEY } = process.env;
if (!MONGODB_URI || !ASAAS_API_URL || !ASAAS_API_KEY) throw new Error('Faltam MONGODB_URI, ASAAS_API_URL ou ASAAS_API_KEY.');
const asaasAmbiente = ASAAS_API_URL.toLowerCase().includes('sandbox') ? 'sandbox' : 'producao';
if (asaasArg !== asaasAmbiente) {
    throw new Error(`ASAAS_API_URL é de ${asaasAmbiente}; passe --asaas=${asaasAmbiente} para confirmar. Nada foi feito.`);
}

const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    access_token: ASAAS_API_KEY,
    'User-Agent': `COEPS-Site/script (Node.js; ${asaasAmbiente === 'sandbox' ? 'sandbox' : 'production'})`,
};
const paymentUrl = (id) => `${ASAAS_API_URL.replace(/\/+$/, '')}/payments/${encodeURIComponent(id)}`;

async function lookup(id) {
    try {
        const response = await fetch(paymentUrl(id), { headers, signal: AbortSignal.timeout(10_000) });
        if (response.status === 404) return { notFound: true };
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const body = await response.json();
        return { status: body.status, deleted: body.deleted === true };
    } catch (error) {
        return { error: error?.name || 'falha' };
    }
}

const client = new MongoClient(MONGODB_URI, { readPreference: 'primary' });
try {
    await client.connect();
    const db = client.db(databaseName);
    const users = await db.collection('usuarios').find(
        { 'pagamento.lista_pagamentos._type': 'activity' },
        { projection: { 'pagamento.lista_pagamentos': 1 } },
    ).toArray();
    const activities = await db.collection('minicursos').find(
        {},
        { projection: { name: 1, participants: 1 } },
    ).toArray();

    const rows = [];
    for (const candidate of findCandidates(users, activities)) {
        const gateway = await lookup(candidate.chargeId);
        rows.push({ ...candidate, statusAsaas: gateway.status ?? (gateway.notFound ? 'NOT_FOUND' : gateway.error), acao: classify(candidate, gateway) });
    }

    const resultadoApply = [];
    if (apply) {
        for (const row of rows.filter((r) => r.acao === 'cancelar')) {
            const again = await lookup(row.chargeId);
            if (again.error || again.notFound || again.deleted || !OPEN_STATUSES.has(String(again.status))) {
                resultadoApply.push({ chargeId: row.chargeId, resultado: 'pulada', statusAsaas: again.status ?? again.error ?? 'NOT_FOUND' });
                continue;
            }
            const response = await fetch(paymentUrl(row.chargeId), { method: 'DELETE', headers, signal: AbortSignal.timeout(10_000) })
                .catch((error) => ({ ok: false, status: error?.name || 'falha' }));
            resultadoApply.push({ chargeId: row.chargeId, resultado: response.ok ? 'excluida' : `falhou (${response.status})` });
        }
    }

    const resumo = {};
    for (const row of rows) resumo[row.acao] = (resumo[row.acao] ?? 0) + 1;
    console.log(JSON.stringify({
        modo: apply ? 'apply' : 'somente-leitura',
        databaseName,
        asaasAmbiente,
        usuariosComCobrancaDeAtividade: users.length,
        resumo,
        linhas: rows.filter((r) => r.acao !== 'ok'),
        ...(apply ? { resultadoApply } : {}),
    }, null, 2));
    if (resultadoApply.some((r) => r.resultado.startsWith('falhou'))) process.exitCode = 1;
} finally {
    await client.close();
}
