import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const editionId = (
  process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID
)?.trim().toUpperCase();
const configId = process.env.PAYMENT_CONFIG_ID || '66bcfceedc9c7250e85b2ac6';

if (!uri || !databaseName) {
  throw new Error('Defina MONGODB_URI e MONGODB_DB antes de executar a migração.');
}
if (!editionId) {
  throw new Error('Defina PAYMENT_EDITION_ID com o identificador da edição atual.');
}
if (!ObjectId.isValid(configId)) {
  throw new Error('PAYMENT_CONFIG_ID não é um ObjectId válido.');
}

const client = new MongoClient(uri);

function cents(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function legacySessionAmounts(paymentSession) {
  if (paymentSession.valoresCentavos) return paymentSession.valoresCentavos;
  const prices = paymentSession.paymentConfig?.precos || {};
  const values = {
    PIX: cents(prices.valorPix),
    BOLETO: cents(prices.valorBoleto),
    DEBIT_CARD: cents(prices.valorDebito),
    CREDIT_CARD: cents(prices.valorAVista),
  };
  return {
    original: values,
    desconto: { PIX: 0, BOLETO: 0, DEBIT_CARD: 0, CREDIT_CARD: 0 },
    final: values,
  };
}

try {
  await client.connect();
  const db = client.db(databaseName);
  const now = new Date();
  const legacyPaidUsers = await db.collection('usuarios').countDocuments({
    'pagamento.situacao': 1,
    'pagamento.tipo_pagamento': { $not: /^organizador$/i },
  });
  const configObjectId = new ObjectId(configId);
  const targetConfig = await db.collection('ingressos_config').findOne(
    { _id: configObjectId },
    { projection: { _id: 1 } },
  );
  if (!targetConfig) {
    throw new Error(`Configuração de pagamento ${configId} não encontrada.`);
  }

  const migrationSession = client.startSession();
  try {
    await migrationSession.withTransaction(async () => {
      await db.collection('ingressos_config').updateMany(
        { _id: { $ne: configObjectId }, ativo: true },
        { $set: { ativo: false, updatedAt: now } },
        { session: migrationSession },
      );
      await db.collection('ingressos_config').updateOne(
        { _id: configObjectId },
        {
          $set: {
            edicaoId: editionId,
            ativo: true,
            updatedAt: now,
          },
        },
        { session: migrationSession },
      );
      await db.collection('ingressos_config').updateOne(
        {
          _id: configObjectId,
          pagantesLegados: { $exists: false },
        },
        { $set: { pagantesLegados: legacyPaidUsers } },
        { session: migrationSession },
      );
      await db.collection('usuarios').updateMany(
        {
          'pagamento.situacao': 1,
          'pagamento.edicaoId': { $exists: false },
        },
        { $set: { 'pagamento.edicaoId': editionId } },
        { session: migrationSession },
      );
    });
  } finally {
    await migrationSession.endSession();
  }

  await db.collection('ingressos_config').createIndex(
    { edicaoId: 1 },
    {
      name: 'payment_config_one_active_per_edition',
      unique: true,
      partialFilterExpression: { ativo: true, edicaoId: { $type: 'string' } },
    },
  );
  await db.collection('ingressos_config').createIndex(
    { ativo: 1 },
    {
      name: 'payment_config_single_active',
      unique: true,
      partialFilterExpression: { ativo: true },
    },
  );

  await db.collection('pagamentos.sessoes').updateMany(
    {
      status: { $in: ['UNPAID', 'PENDING', 'PENDENTE'] },
      $or: [
        { orderId: { $type: 'string' } },
        { paymentUrl: { $type: 'string' } },
      ],
    },
    {
      $set: {
        status: 'PAYMENT_PENDING',
        metodoPagamento: 'PIX',
        updatedAt: now,
      },
    },
  );

  await db.collection('pagamentos.sessoes').updateMany(
    {
      status: { $in: ['UNPAID', 'PENDING', 'PENDENTE'] },
      orderId: { $exists: false },
      paymentUrl: { $exists: false },
    },
    { $set: { status: 'OPEN', updatedAt: now } },
  );

  await db.collection('pagamentos.sessoes').updateMany(
    { status: 'PAID' },
    {
      $set: { status: 'CONFIRMED', updatedAt: now },
      $unset: { activeKey: '' },
    },
  );

  await db.collection('pagamentos.sessoes').updateMany(
    {
      status: 'CONFIRMED',
      owner: { $type: 'objectId' },
      type: { $in: ['ticket', null] },
      $or: [
        { edicaoId: { $exists: false } },
        { edicaoId: null },
      ],
    },
    {
      $set: {
        edicaoId: editionId,
        type: 'ticket',
        legacyCapacitySource: 'USER_PAYMENT',
        updatedAt: now,
      },
      $unset: { activeKey: '' },
    },
  );

  await db.collection('pagamentos.sessoes').updateMany(
    { status: { $in: ['CONFIRMED', 'EXPIRED', 'CANCELLED', 'REFUNDED'] } },
    { $unset: { activeKey: '' } },
  );

  const legacyActiveSessions = await db.collection('pagamentos.sessoes')
    .find({
      status: { $in: ['OPEN', 'CREATING_PAYMENT', 'PAYMENT_PENDING'] },
      owner: { $type: 'objectId' },
      type: { $in: ['ticket', null] },
      $or: [
        { edicaoId: { $exists: false } },
        { edicaoId: null },
        { edicaoId: editionId },
      ],
    })
    .sort({ status: -1, updatedAt: -1, createdAt: -1 })
    .toArray();
  const ownersWithActiveKey = new Set();

  for (const paymentSession of legacyActiveSessions) {
    const ownerKey = paymentSession.owner.toHexString();
    const receivesActiveKey = !ownersWithActiveKey.has(ownerKey);
    if (receivesActiveKey) ownersWithActiveKey.add(ownerKey);

    await db.collection('pagamentos.sessoes').updateOne(
      { _id: paymentSession._id },
      {
        $set: {
          edicaoId: editionId,
          type: paymentSession.type || 'ticket',
          updatedAt: now,
          ...(receivesActiveKey
            ? { activeKey: `${editionId}:${ownerKey}:ticket` }
            : {
                status: 'PAYMENT_REVIEW_REQUIRED',
                gatewayState: 'PAYMENT_REVIEW_REQUIRED',
                reconciliationReason: 'Mais de uma sessão ativa legada para o usuário',
                reviewRequiredAt: now,
              }),
        },
        ...(!receivesActiveKey ? { $unset: { activeKey: '' } } : {}),
      },
    );

    await db.collection('pagamentos.atribuicoes').updateOne(
      { compraId: paymentSession._id },
      {
        $setOnInsert: {
          compraId: paymentSession._id,
          edicaoId: editionId,
          usuarioId: paymentSession.owner,
          ...(paymentSession.codigoDesconto
            ? { codigoDesconto: paymentSession.codigoDesconto }
            : {}),
          ...(paymentSession.codigoRastreio
            ? { codigoRastreio: paymentSession.codigoRastreio }
            : {}),
          valoresCentavos: legacySessionAmounts(paymentSession),
          status:
            paymentSession.status === 'PAYMENT_PENDING'
              ? 'PAGAMENTO_PENDENTE'
              : 'ABERTA',
          pagamento: {
            metodo: paymentSession.metodoPagamento,
            checkoutId: paymentSession.orderId,
            paymentId: paymentSession.paymentId,
            invoiceNumber: paymentSession.invoiceNumber,
          },
          createdAt: paymentSession.createdAt || now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }

  await db.collection('pagamentos.codigos').createIndexes([
    {
      key: { edicaoId: 1, codigoNormalizado: 1 },
      name: 'payment_code_unique_per_edition',
      unique: true,
    },
    {
      key: { edicaoId: 1, tipo: 1, status: 1, createdAt: -1 },
      name: 'payment_code_admin_listing',
    },
    {
      key: {
        tipo: 1,
        status: 1,
        'reserva.cobrancaExternaCriada': 1,
        'reserva.reservadoAte': 1,
      },
      name: 'payment_code_available_reservations',
    },
  ]);

  await db.collection('pagamentos.atribuicoes').createIndexes([
    {
      key: { compraId: 1 },
      name: 'payment_assignment_purchase_unique',
      unique: true,
    },
    {
      key: { edicaoId: 1, status: 1, confirmedAt: -1 },
      name: 'payment_assignment_edition_status',
    },
    {
      key: { edicaoId: 1, 'codigoDesconto.codigoId': 1, status: 1 },
      name: 'payment_assignment_discount_sales',
    },
    {
      key: { edicaoId: 1, 'codigoRastreio.codigoId': 1, status: 1 },
      name: 'payment_assignment_tracking_sales',
    },
    {
      key: { 'pagamento.paymentId': 1 },
      name: 'payment_assignment_provider_payment_unique',
      unique: true,
      partialFilterExpression: { 'pagamento.paymentId': { $type: 'string' } },
    },
    {
      key: { 'pagamento.checkoutId': 1 },
      name: 'payment_assignment_provider_checkout_unique',
      unique: true,
      partialFilterExpression: { 'pagamento.checkoutId': { $type: 'string' } },
    },
  ]);

  await db.collection('pagamentos.sessoes').createIndexes([
    {
      key: { activeKey: 1 },
      name: 'payment_session_active_owner_unique',
      unique: true,
      partialFilterExpression: { activeKey: { $type: 'string' } },
    },
    {
      key: { edicaoId: 1, status: 1, updatedAt: -1 },
      name: 'payment_session_edition_status',
    },
  ]);

  await db.collection('pagamentos.webhook_eventos').createIndexes([
    {
      key: { provider: 1, eventId: 1 },
      name: 'payment_webhook_event_unique',
      unique: true,
    },
    {
      key: { processedAt: 1 },
      name: 'payment_webhook_processed_ttl_90d',
      expireAfterSeconds: 90 * 24 * 60 * 60,
      partialFilterExpression: { status: 'PROCESSED' },
    },
  ]);

  await db.collection('pagamentos.codigo_tentativas').createIndex(
    { expiresAt: 1 },
    {
      name: 'payment_code_attempts_ttl',
      expireAfterSeconds: 0,
    },
  );

  await db.collection('pagamentos.comprovantes').createIndex(
    { compraId: 1 },
    {
      name: 'payment_receipt_purchase_unique',
      unique: true,
      partialFilterExpression: { compraId: { $type: 'objectId' } },
    },
  );

  const hello = await db.admin().command({ hello: 1 });
  console.log(
    JSON.stringify(
      {
        ok: true,
        edicaoId: editionId,
        configId,
        transactionsLikelySupported: Boolean(
          hello.setName && hello.logicalSessionTimeoutMinutes,
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
