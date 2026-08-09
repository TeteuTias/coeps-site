import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith('--')) continue;
  const [inlineKey, inlineValue] = token.slice(2).split('=', 2);
  if (inlineValue !== undefined) args.set(inlineKey, inlineValue);
  else if (process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    args.set(inlineKey, process.argv[index + 1]);
    index += 1;
  } else args.set(inlineKey, true);
}

const uri = process.env.MONGODB_URI;
const configuredDatabase = process.env.MONGODB_DB;
const requestedDatabase = String(args.get('database') || '');
const requestedEdition = String(args.get('edition') || '').trim().toUpperCase();
const protectedEventId = String(args.get('protect-event') || '').trim();
const apply = args.get('apply') === true;
const confirmation = String(args.get('confirm') || '');

if (!uri || !configuredDatabase) throw new Error('Defina MONGODB_URI e MONGODB_DB.');
if (!requestedDatabase || requestedDatabase !== configuredDatabase) {
  throw new Error('--database deve coincidir exatamente com MONGODB_DB.');
}
if (!requestedEdition) throw new Error('Informe --edition com a edição ativa esperada.');

const indexPlans = [
  ['ingressos_config', { edicaoId: 1 }, {
    name: 'payment_config_one_active_per_edition', unique: true,
    partialFilterExpression: { ativo: true, edicaoId: { $type: 'string' } },
  }],
  ['ingressos_config', { ativo: 1 }, {
    name: 'payment_config_single_active', unique: true,
    partialFilterExpression: { ativo: true },
  }],
  ['pagamentos.codigos', { edicaoId: 1, codigoNormalizado: 1 }, {
    name: 'payment_code_unique_per_edition', unique: true,
  }],
  ['pagamentos.codigos', { edicaoId: 1, tipo: 1, status: 1, createdAt: -1 }, {
    name: 'payment_code_admin_listing',
  }],
  ['pagamentos.atribuicoes', { compraId: 1 }, {
    name: 'payment_assignment_purchase_unique', unique: true,
  }],
  ['pagamentos.atribuicoes', { edicaoId: 1, status: 1, confirmedAt: -1 }, {
    name: 'payment_assignment_edition_status',
  }],
  ['pagamentos.atribuicoes', { usuarioId: 1, createdAt: -1 }, {
    name: 'payment_assignment_user_created',
  }],
  ['pagamentos.atribuicoes', { 'pagamento.paymentId': 1 }, {
    name: 'payment_assignment_provider_payment_unique', unique: true,
    partialFilterExpression: { 'pagamento.paymentId': { $type: 'string' } },
  }],
  ['pagamentos.atribuicoes', { 'pagamento.checkoutId': 1 }, {
    name: 'payment_assignment_provider_checkout_unique', unique: true,
    partialFilterExpression: { 'pagamento.checkoutId': { $type: 'string' } },
  }],
  ['pagamentos.atribuicoes', { 'installmentPlan.installmentId': 1 }, {
    name: 'payment_assignment_installment_unique', unique: true,
    partialFilterExpression: { 'installmentPlan.installmentId': { $type: 'string' } },
  }],
  ['pagamentos.sessoes', { activeKey: 1 }, {
    name: 'payment_session_active_owner_unique', unique: true,
    partialFilterExpression: { activeKey: { $type: 'string' } },
  }],
  ['pagamentos.sessoes', { edicaoId: 1, status: 1, updatedAt: -1 }, {
    name: 'payment_session_edition_status',
  }],
  ['pagamentos.sessoes', { owner: 1, createdAt: -1 }, {
    name: 'payment_session_owner_created',
  }],
  ['pagamentos.sessoes', { 'installmentPlan.installmentId': 1 }, {
    name: 'payment_session_installment_unique', unique: true,
    partialFilterExpression: { 'installmentPlan.installmentId': { $type: 'string' } },
  }],
  ['pagamentos.webhook_eventos_v2', { provider: 1, eventId: 1 }, {
    name: 'payment_webhook_event_v2_unique', unique: true,
  }],
  ['pagamentos.webhook_eventos_v2', { status: 1, nextAttemptAt: 1, leaseUntil: 1, receivedAt: 1 }, {
    name: 'payment_webhook_event_v2_work_queue',
  }],
  ['pagamentos.webhook_eventos_v2', { purchaseId: 1, status: 1, receivedAt: -1 }, {
    name: 'payment_webhook_event_v2_purchase_status',
  }],
  ['pagamentos.webhook_eventos_v2', { installmentId: 1, status: 1, receivedAt: -1 }, {
    name: 'payment_webhook_event_v2_installment_status',
    partialFilterExpression: { installmentId: { $type: 'string' } },
  }],
  ['pagamentos.webhook_eventos_v2', { expiresAt: 1 }, {
    name: 'payment_webhook_event_v2_ttl', expireAfterSeconds: 0,
  }],
  ['pagamentos.codigo_tentativas', { expiresAt: 1 }, {
    name: 'payment_code_attempts_ttl', expireAfterSeconds: 0,
  }],
  ['pagamentos.comprovantes', { compraId: 1 }, {
    name: 'payment_receipt_purchase_unique', unique: true,
    partialFilterExpression: { compraId: { $type: 'objectId' } },
  }],
];

const duplicateChecks = [
  ['payment_code_unique_per_edition', 'pagamentos.codigos', { edicaoId: '$edicaoId', value: '$codigoNormalizado' }, {}],
  ['payment_assignment_purchase_unique', 'pagamentos.atribuicoes', { value: '$compraId' }, {}],
  ['payment_assignment_provider_payment_unique', 'pagamentos.atribuicoes', { value: '$pagamento.paymentId' }, { 'pagamento.paymentId': { $type: 'string' } }],
  ['payment_assignment_provider_checkout_unique', 'pagamentos.atribuicoes', { value: '$pagamento.checkoutId' }, { 'pagamento.checkoutId': { $type: 'string' } }],
  ['payment_assignment_installment_unique', 'pagamentos.atribuicoes', { value: '$installmentPlan.installmentId' }, { 'installmentPlan.installmentId': { $type: 'string' } }],
  ['payment_session_active_owner_unique', 'pagamentos.sessoes', { value: '$activeKey' }, { activeKey: { $type: 'string' } }],
  ['payment_session_installment_unique', 'pagamentos.sessoes', { value: '$installmentPlan.installmentId' }, { 'installmentPlan.installmentId': { $type: 'string' } }],
  ['payment_webhook_event_v2_unique', 'pagamentos.webhook_eventos_v2', { provider: '$provider', value: '$eventId' }, {}],
  ['payment_receipt_purchase_unique', 'pagamentos.comprovantes', { value: '$compraId' }, { compraId: { $type: 'objectId' } }],
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

async function indexesFor(db, collectionName) {
  try {
    return await db.collection(collectionName).listIndexes().toArray();
  } catch (error) {
    if (error?.codeName === 'NamespaceNotFound' || error?.code === 26) return [];
    throw error;
  }
}

async function protectedFinancialSnapshot(db, eventId) {
  if (!eventId) return null;
  const events = await db.collection('pagamentos.webhook_eventos').find(
    { provider: 'ASAAS', eventId },
    { projection: { _id: 1, eventId: 1, paymentId: 1, status: 1, attempts: 1 } },
  ).sort({ _id: 1 }).toArray();
  if (!events.length) throw new Error(`O evento protegido ${eventId} não existe no ledger legado.`);

  const paymentIds = [...new Set(events.map((event) => event.paymentId).filter(Boolean).map(String))];
  const [sessions, assignments, users] = await Promise.all([
    db.collection('pagamentos.sessoes').find(
      { paymentId: { $in: paymentIds } },
      { projection: { _id: 1, owner: 1, edicaoId: 1, status: 1, paymentId: 1, invoiceNumber: 1 } },
    ).sort({ _id: 1 }).toArray(),
    db.collection('pagamentos.atribuicoes').find(
      { 'pagamento.paymentId': { $in: paymentIds } },
      { projection: { _id: 1, compraId: 1, usuarioId: 1, edicaoId: 1, status: 1, pagamento: 1, valorSelecionadoCentavos: 1 } },
    ).sort({ _id: 1 }).toArray(),
    db.collection('usuarios').find(
      { 'pagamento.lista_pagamentos.id': { $in: paymentIds } },
      { projection: { _id: 1, pagamento: 1 } },
    ).sort({ _id: 1 }).toArray(),
  ]);
  const purchaseIds = [...new Map(
    [...sessions.map((session) => session._id), ...assignments.map((assignment) => assignment.compraId)]
      .filter(Boolean)
      .map((id) => [String(id), id]),
  ).values()];
  const receipts = await db.collection('pagamentos.comprovantes').find(
    { compraId: { $in: purchaseIds } },
    { projection: { _id: 1, compraId: 1, owner: 1, status: 1, type: 1 } },
  ).sort({ _id: 1 }).toArray();
  const snapshot = { events, sessions, assignments, users, receipts };

  return {
    eventId,
    paymentCount: paymentIds.length,
    documentCounts: {
      events: events.length,
      sessions: sessions.length,
      assignments: assignments.length,
      users: users.length,
      receipts: receipts.length,
    },
    hash: hash(snapshot),
  };
}

function indexMatches(existing, key, options) {
  return hash(existing.key) === hash(key) &&
    Boolean(existing.unique) === Boolean(options.unique) &&
    Number(existing.expireAfterSeconds ?? -1) === Number(options.expireAfterSeconds ?? -1) &&
    hash(existing.partialFilterExpression ?? null) === hash(options.partialFilterExpression ?? null);
}

const client = new MongoClient(uri, { readPreference: 'primary' });
try {
  await client.connect();
  const db = client.db(configuredDatabase);
  const activeConfigs = await db.collection('ingressos_config').find(
    { ativo: true },
    { projection: { _id: 1, edicaoId: 1 } },
  ).toArray();
  if (activeConfigs.length !== 1 || String(activeConfigs[0].edicaoId).toUpperCase() !== requestedEdition) {
    throw new Error(`Edição ativa divergente. Esperado ${requestedEdition}; encontrados ${JSON.stringify(activeConfigs)}`);
  }

  const blockers = [];
  for (const [name, collectionName, groupId, match] of duplicateChecks) {
    const groups = await db.collection(collectionName).aggregate([
      { $match: match },
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ]).toArray();
    if (groups.length) blockers.push({ name, duplicateGroups: groups.length });
  }

  const legacyProjection = await db.collection('pagamentos.webhook_eventos')
    .find({}, { projection: { _id: 1, provider: 1, eventId: 1, eventType: 1, paymentId: 1, status: 1, attempts: 1, receivedAt: 1, updatedAt: 1 } })
    .sort({ _id: 1 })
    .toArray();
  const legacySnapshot = { count: legacyProjection.length, hash: hash(legacyProjection) };
  if (apply && legacyProjection.length && !protectedEventId) {
    throw new Error('Use --protect-event <EVENT_ID> ao aplicar índices em um banco com ledger legado.');
  }
  const protectedFinancial = await protectedFinancialSnapshot(db, protectedEventId);

  const planned = [];
  for (const [collectionName, key, options] of indexPlans) {
    const existing = (await indexesFor(db, collectionName)).find((index) => index.name === options.name);
    if (existing && !indexMatches(existing, key, options)) {
      blockers.push({ name: options.name, conflict: 'existing_index_has_different_spec' });
    }
    planned.push({ collectionName, name: options.name, action: existing ? 'noop' : 'create' });
  }

  const preflight = {
    database: configuredDatabase,
    edition: requestedEdition,
    activeConfigId: String(activeConfigs[0]._id),
    legacySnapshot,
    protectedFinancial,
    blockers,
    planned,
  };
  const digest = hash(preflight);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', digest, ...preflight }, null, 2));

  if (blockers.length) throw new Error('Preflight encontrou bloqueadores; nenhum índice foi alterado.');
  if (!apply) process.exitCode = 0;
  else {
    if (!confirmation || confirmation !== digest) {
      throw new Error(`Repita com --apply --confirm ${digest}`);
    }
    for (const [collectionName, key, options] of indexPlans) {
      const existing = (await indexesFor(db, collectionName)).find((index) => index.name === options.name);
      if (!existing) await db.collection(collectionName).createIndex(key, options);
    }

    const legacyAfter = await db.collection('pagamentos.webhook_eventos')
      .find({}, { projection: { _id: 1, provider: 1, eventId: 1, eventType: 1, paymentId: 1, status: 1, attempts: 1, receivedAt: 1, updatedAt: 1 } })
      .sort({ _id: 1 })
      .toArray();
    const legacyAfterSnapshot = { count: legacyAfter.length, hash: hash(legacyAfter) };
    if (legacyAfterSnapshot.count !== legacySnapshot.count || legacyAfterSnapshot.hash !== legacySnapshot.hash) {
      throw new Error('O ledger legado mudou durante a criação dos índices.');
    }
    const protectedFinancialAfter = await protectedFinancialSnapshot(db, protectedEventId);
    if (hash(protectedFinancialAfter) !== hash(protectedFinancial)) {
      throw new Error('Os documentos financeiros protegidos mudaram durante a criação dos índices.');
    }
    console.log(JSON.stringify({
      ok: true,
      legacyPreserved: true,
      protectedFinancialPreserved: true,
      legacySnapshot,
      protectedFinancial,
    }, null, 2));
  }
} finally {
  await client.close();
}
