import { createHash, createHmac, randomBytes } from 'node:crypto';

const generate = process.argv.includes('--generate');
const show = process.argv.includes('--show');
const secret = generate
  ? `payroot_${randomBytes(32).toString('base64url')}`
  : process.env.PAYMENT_RECONCILIATION_SECRET?.trim();
const apiUrl = process.env.ASAAS_API_URL?.trim();

if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
  throw new Error('PAYMENT_RECONCILIATION_SECRET deve conter ao menos 32 bytes aleatórios.');
}
if (generate && !show) {
  throw new Error('Use --generate --show para exibir uma nova raiz uma única vez.');
}
if (!apiUrl) {
  throw new Error('ASAAS_API_URL é obrigatória para separar Sandbox e Produção.');
}

const host = new URL(apiUrl).host.toLowerCase();

function derive(purpose) {
  const context = purpose === 'webhook'
    ? `coeps/payments/asaas/webhook/v1|${host}`
    : `coeps/payments/reconciliation/v1|${host}`;
  const prefix = purpose === 'webhook' ? 'whsec_' : 'rec_';
  return `${prefix}${createHmac('sha256', secret).update(context, 'utf8').digest('base64url')}`;
}

function fingerprint(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}

const webhook = derive('webhook');
const reconciliation = derive('reconciliation');

console.log(JSON.stringify({
  asaasHost: host,
  ...(generate ? { generatedRootSecret: secret } : {}),
  webhookAuthToken: show ? webhook : `[hidden:${fingerprint(webhook)}]`,
  reconciliationBearer: show ? reconciliation : `[hidden:${fingerprint(reconciliation)}]`,
}, null, 2));
