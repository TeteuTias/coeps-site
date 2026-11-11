// Vagas de minicurso pago presas por PIX não pago.
// A reserva dura 15 minutos (cobranças antigas, sem o horário da reserva: até o fim do dia do vencimento).
// Passado o prazo, a reconciliação do site exclui a cobrança no Asaas e o webhook PAYMENT_DELETED tira a
// pessoa da atividade. Este script mostra, antes do deploy, quem sairia na primeira rodada.
//
// Uso (variáveis MONGODB_URI, ASAAS_API_URL e ASAAS_API_KEY no ambiente):
//   node --experimental-strip-types scripts/payments/release-unpaid-activity-seats.mjs --asaas=producao
//     Só leitura: lê minicursos e usuarios, consulta cada cobrança vencida no Asaas (GET) e lista.
//   node --experimental-strip-types scripts/payments/release-unpaid-activity-seats.mjs --asaas=producao --apply
//     Exclui no Asaas (DELETE) as cobranças "would_release". Não escreve no banco: quem tira a pessoa da
//     atividade é o webhook PAYMENT_DELETED do site. Cobrança já paga ou já excluída no Asaas (webhook
//     perdido) fica para a reconciliação do site aplicar.
// --asaas=producao|sandbox precisa bater com ASAAS_API_URL, para não rodar no Asaas errado.
// Só mexe em minicurso pago que ainda não começou. A saída não tem nome, CPF nem e-mail.
// Quem pagou "por fora" e segue com cobrança vencida no Asaas aparece na lista: marque a cobrança como
// recebida em dinheiro no Asaas antes de aplicar ou de fazer o deploy.
import { MongoClient } from 'mongodb';
import { releaseUnpaidActivitySeats } from '../../app/lib/payments/activity-seat-release.ts';

const databaseName = 'coeps2026';
const apply = process.argv.includes('--apply');
const asaasArg = process.argv.find((arg) => arg.startsWith('--asaas='))?.split('=')[1];

const { MONGODB_URI, ASAAS_API_URL, ASAAS_API_KEY } = process.env;
if (!MONGODB_URI || !ASAAS_API_URL || !ASAAS_API_KEY) throw new Error('Faltam MONGODB_URI, ASAAS_API_URL ou ASAAS_API_KEY.');
const asaasAmbiente = ASAAS_API_URL.toLowerCase().includes('sandbox') ? 'sandbox' : 'producao';
if (asaasArg !== asaasAmbiente) {
    throw new Error(`ASAAS_API_URL é de ${asaasAmbiente}; passe --asaas=${asaasAmbiente} para confirmar. Nada foi feito.`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Asaas limita requisições por minuto: espaça as chamadas.
const pacedFetch = async (...args) => {
    await wait(250);
    return fetch(...args);
};

const client = new MongoClient(MONGODB_URI);
try {
    await client.connect();
    const db = client.db(databaseName);
    const semEscrita = [];
    const report = await releaseUnpaidActivitySeats(db, {
        apiUrl: ASAAS_API_URL,
        apiKey: ASAAS_API_KEY,
        limit: 5_000,
        dryRun: !apply,
        fetchImpl: pacedFetch,
        // O script nunca escreve no banco.
        applyLegacyEvent: async (payload) => { semEscrita.push({ evento: payload.event, cobranca: payload.payment?.id }); },
    });
    console.log(JSON.stringify({
        modo: apply ? 'apply' : 'somente-leitura',
        databaseName,
        asaasAmbiente,
        resumo: {
            liberadas: report.released,
            pagasNoAsaasComWebhookPerdido: report.confirmed,
            ignoradas: report.ignored,
            falhas: report.failed,
        },
        linhas: report.details,
        ...(semEscrita.length ? { deixadoParaAReconciliacaoDoSite: semEscrita } : {}),
    }, null, 2));
    if (report.failed) process.exitCode = 1;
} finally {
    await client.close();
}
