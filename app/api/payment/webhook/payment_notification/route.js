import { createHash, timingSafeEqual } from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  consumeDiscountCode,
  releaseDiscountReservation,
  updatePaymentAssignment,
  updateUserRegistrationAfterRefund,
} from '@/lib/payments/codes';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import {
  cancellationEligibleAtForDelinquency,
  getPaymentOverdueGraceDays,
} from '@/lib/payments/overdue';

const WEBHOOK_EVENTS_COLLECTION = 'pagamentos.webhook_eventos';

function secureEquals(received, expected) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function getEventId(payload) {
  if (payload?.id) return String(payload.id);
  return createHash('sha256')
    .update(
      JSON.stringify([
        payload?.event,
        payload?.payment?.id,
        payload?.payment?.invoiceNumber,
        payload?.dateCreated,
      ]),
    )
    .digest('hex');
}

async function claimEvent(db, payload) {
  const eventId = getEventId(payload);
  const now = new Date();
  try {
    await db.collection(WEBHOOK_EVENTS_COLLECTION).insertOne({
      provider: 'ASAAS',
      eventId,
      eventType: String(payload?.event || 'UNKNOWN'),
      paymentId: payload?.payment?.id || null,
      status: 'PROCESSING',
      attempts: 1,
      receivedAt: now,
      updatedAt: now,
    });
    return { eventId, claimed: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
  const claimed = await db.collection(WEBHOOK_EVENTS_COLLECTION).findOneAndUpdate(
    {
      provider: 'ASAAS',
      eventId,
      $or: [
        { status: 'FAILED' },
        { status: 'PROCESSING', updatedAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: { status: 'PROCESSING', updatedAt: now },
      $inc: { attempts: 1 },
      $unset: { lastError: '' },
    },
    { returnDocument: 'after' },
  );

  return { eventId, claimed: Boolean(claimed) };
}

async function finishEvent(db, eventId, status, extra = {}) {
  await db.collection(WEBHOOK_EVENTS_COLLECTION).updateOne(
    { provider: 'ASAAS', eventId },
    {
      $set: {
        status,
        updatedAt: new Date(),
        ...(status === 'PROCESSED' ? { processedAt: new Date() } : {}),
        ...extra,
      },
    },
  );
}

function sessionCorrelationFilter(payload) {
  const payment = payload?.payment || {};
  const checkout = payload?.checkout || {};
  const references = [payment.externalReference, checkout.externalReference].filter(Boolean);
  const ids = [payment.checkoutSession, checkout.id].filter(Boolean);
  const ors = [];

  for (const reference of references) {
    if (ObjectId.isValid(String(reference))) {
      ors.push({ _id: new ObjectId(String(reference)) });
    }
  }
  for (const id of ids) ors.push({ orderId: String(id) });
  if (payment.id) ors.push({ paymentId: String(payment.id) });
  if (payment.invoiceNumber) ors.push({ invoiceNumber: String(payment.invoiceNumber) });

  return ors.length ? { $or: ors } : null;
}

function isConfirmedEvent(event, payment) {
  if (event) {
    return event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED';
  }
  return payment?.status === 'CONFIRMED' || payment?.status === 'RECEIVED';
}

function isCancelledEvent(event) {
  return [
    'PAYMENT_DELETED',
    'PAYMENT_CANCELED',
    'PAYMENT_CANCELLED',
    'CHECKOUT_EXPIRED',
    'CHECKOUT_CANCELED',
    'CHECKOUT_CANCELLED',
  ].includes(event);
}

function isFullRefundEvent(event) {
  return ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_DISPUTE_LOST'].includes(event);
}

function isPartialRefundEvent(event) {
  return event === 'PAYMENT_PARTIALLY_REFUNDED' || event === 'PAYMENT_REFUND_IN_PROGRESS';
}

function isChargebackPendingEvent(event) {
  return ['PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE'].includes(event);
}

function isNonTerminalDelinquencyEvent(event) {
  return ['PAYMENT_OVERDUE', 'PAYMENT_BANK_SLIP_CANCELLED'].includes(event);
}

async function updateLegacyPayment(
  db,
  payload,
  mongoSession,
  allowConfirmedTransition = true,
  manageLegacyTicketRefund = true,
) {
  const event = String(payload?.event || '');
  const payment = payload?.payment || {};
  if (!payment.customer || (!payment.invoiceNumber && !payment.id)) return false;

  const match = payment.invoiceNumber
    ? { invoiceNumber: payment.invoiceNumber }
    : { id: payment.id };
  const user = await db.collection('usuarios').findOne(
    {
      id_api: payment.customer,
      pagamento: { $exists: true },
      'pagamento.lista_pagamentos': { $elemMatch: match },
    },
    {
      projection: {
        _id: 1,
        'pagamento.situacao': 1,
        'pagamento.lista_pagamentos': { $elemMatch: match },
      },
      session: mongoSession,
    },
  );
  if (!user) return false;

  const storedPayment = user.pagamento?.lista_pagamentos?.[0];
  let replacementAssignment = null;
  let hasOtherConfirmedLegacyTicket = false;
  if (
    manageLegacyTicketRefund &&
    isFullRefundEvent(event) &&
    storedPayment?._type === 'ticket'
  ) {
    const differentPayment = payment.invoiceNumber
      ? { invoiceNumber: { $ne: payment.invoiceNumber } }
      : { id: { $ne: payment.id } };
    [replacementAssignment, hasOtherConfirmedLegacyTicket] = await Promise.all([
      db.collection('pagamentos.atribuicoes').findOne(
        { usuarioId: user._id, status: 'CONFIRMADA' },
        { projection: { compraId: 1, edicaoId: 1 }, session: mongoSession },
      ),
      db.collection('usuarios').findOne(
        {
          _id: user._id,
          'pagamento.lista_pagamentos': {
            $elemMatch: {
              _type: 'ticket',
              ...differentPayment,
              status: {
                $in: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CONFIRMED', 'RECEIVED'],
              },
            },
          },
        },
        { projection: { _id: 1 }, session: mongoSession },
      ).then(Boolean),
    ]);
  }
  if (event === 'PAYMENT_DELETED') {
    await db.collection('usuarios').updateOne(
      { _id: user._id },
      { $pull: { 'pagamento.lista_pagamentos': match } },
      { session: mongoSession },
    );
    return true;
  }

  const set = {
    'pagamento.lista_pagamentos.$[payment].status': event,
    'pagamento.lista_pagamentos.$[payment].lastWebhookEventId': getEventId(payload),
    'pagamento.lista_pagamentos.$[payment].lastWebhookAt': new Date(),
  };
  if (
    allowConfirmedTransition &&
    isConfirmedEvent(event, payment) &&
    storedPayment?._type === 'ticket'
  ) {
    set['pagamento.situacao'] = 1;
    set['pagamento.tipo_pagamento'] = 'asaas';
  } else if (
    isCancelledEvent(event) &&
    storedPayment?._type === 'ticket' &&
    user.pagamento?.situacao !== 1
  ) {
    set['pagamento.situacao'] = 0;
  } else if (
    manageLegacyTicketRefund &&
    isFullRefundEvent(event) &&
    storedPayment?._type === 'ticket'
  ) {
    if (replacementAssignment) {
      set['pagamento.situacao'] = 1;
      set['pagamento.edicaoId'] = replacementAssignment.edicaoId;
      set['pagamento.compraId'] = replacementAssignment.compraId;
    } else if (!hasOtherConfirmedLegacyTicket) {
      set['pagamento.situacao'] = 0;
    }
  }

  await db.collection('usuarios').updateOne(
    { _id: user._id },
    { $set: set },
    {
      arrayFilters: [
        payment.invoiceNumber
          ? { 'payment.invoiceNumber': payment.invoiceNumber }
          : { 'payment.id': payment.id },
      ],
      session: mongoSession,
    },
  );

  if (
    (isCancelledEvent(event) ||
      isFullRefundEvent(event) ||
      isNonTerminalDelinquencyEvent(event)) &&
    storedPayment?._type === 'activity' &&
    ObjectId.isValid(String(storedPayment?._eventID))
  ) {
    await db.collection('minicursos').updateOne(
      { _id: new ObjectId(storedPayment._eventID) },
      { $pull: { participants: storedPayment._userId } },
      { session: mongoSession },
    );
  }
  return true;
}

async function confirmSessionPayment(db, session, payload, mongoSession) {
  if (session.status === 'REFUNDED') {
    return 'TERMINAL_IGNORED';
  }

  if (['CANCELLED', 'EXPIRED'].includes(session.status)) {
    await db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id },
      {
        $set: {
          gatewayState: 'PAYMENT_REVIEW_REQUIRED',
          reconciliationReason: `Confirmação recebida após ${session.status}`,
          reviewRequiredAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session: mongoSession },
    );
    return 'REVIEW_REQUIRED';
  }

  if (session.status === 'CONFIRMED') return 'ALREADY_CONFIRMED';

  const now = new Date();
  const payment = payload.payment || {};
  const transition = await db.collection('pagamentos.sessoes').updateOne(
    {
      _id: session._id,
      status: {
        $in: [
          'OPEN',
          'CREATING_PAYMENT',
          'PAYMENT_PENDING',
          'PAYMENT_REVIEW_REQUIRED',
        ],
      },
    },
    {
      $set: {
        status: 'CONFIRMED',
        gatewayState: payment.status || payload.event,
        paymentId: payment.id || session.paymentId,
        invoiceNumber: payment.invoiceNumber || session.invoiceNumber,
        confirmedAt: now,
        updatedAt: now,
      },
      $unset: { activeKey: '' },
    },
    { session: mongoSession },
  );
  if (transition.modifiedCount !== 1) return 'NOOP';

  await db.collection('usuarios').updateOne(
      { _id: session.owner },
      {
        $set: {
          'pagamento.situacao': 1,
          'pagamento.tipo_pagamento': 'asaas',
          'pagamento.edicaoId': session.edicaoId,
          'pagamento.compraId': session._id,
        },
      },
      { session: mongoSession },
  );
  await updatePaymentAssignment(db, session._id, 'CONFIRMADA', {
      metodo: payment.billingType || session.metodoPagamento,
      checkoutId: payment.checkoutSession || session.orderId,
      paymentId: payment.id || session.paymentId,
      invoiceNumber: payment.invoiceNumber || session.invoiceNumber,
    }, mongoSession);
  await db.collection('pagamentos.comprovantes').updateOne(
      { compraId: session._id },
      {
        $setOnInsert: {
          compraId: session._id,
          owner: session.owner,
          type: 'ticket',
          title: 'EM BREVE!',
          createdAt: now,
        },
        $set: { status: 'PAID', updatedAt: now },
      },
      { upsert: true, session: mongoSession },
  );
  const discountConsumed = await consumeDiscountCode(
    db,
    session._id,
    mongoSession,
    session.codigoDesconto?.codigoId,
  );
  if (session.codigoDesconto && !discountConsumed) {
    throw new Error('A confirmação não conseguiu marcar o desconto como usado.');
  }
  return 'CONFIRMED';
}

async function cancelSessionPayment(db, session, payload, mongoSession) {
  if (['CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(session.status)) return false;
  const event = String(payload.event || '');
  const status = event.includes('EXPIRED') || event === 'PAYMENT_OVERDUE' ? 'EXPIRED' : 'CANCELLED';
  const assignmentStatus = status === 'EXPIRED' ? 'EXPIRADA' : 'CANCELADA';

  const result = await db.collection('pagamentos.sessoes').updateOne(
    {
      _id: session._id,
      status: { $nin: ['CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED'] },
    },
    {
      $set: {
        status,
        gatewayState: payload?.payment?.status || event,
        terminalAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: { activeKey: '' },
    },
    { session: mongoSession },
  );

  if (result.modifiedCount === 1) {
    await releaseDiscountReservation(db, session._id, mongoSession);
    await updatePaymentAssignment(db, session._id, assignmentStatus, undefined, mongoSession);
    await db.collection('usuarios').updateOne(
        { _id: session.owner, 'pagamento.situacao': { $ne: 1 } },
        { $set: { 'pagamento.situacao': 0 } },
        { session: mongoSession },
    );
    return true;
  }
  return false;
}

async function refundSessionPayment(db, session, payload, mongoSession) {
  const event = String(payload.event || '');
  const refundStatus = event === 'PAYMENT_PARTIALLY_REFUNDED'
    ? 'PARTIAL'
    : event === 'PAYMENT_REFUND_IN_PROGRESS'
      ? 'IN_PROGRESS'
      : 'FULL';

  if (session.status === 'REFUNDED') return 'ALREADY_REFUNDED';

  if (['CANCELLED', 'EXPIRED'].includes(session.status)) {
    const discountConsumed = await consumeDiscountCode(
      db,
      session._id,
      mongoSession,
      session.codigoDesconto?.codigoId,
    );
    await db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id, status: session.status },
      {
        $set: {
          gatewayState: 'PAYMENT_REVIEW_REQUIRED',
          refundStatus,
          reconciliationReason: `Estorno recebido após ${session.status}`,
          discountConsumptionConflict: Boolean(
            session.codigoDesconto && !discountConsumed,
          ),
          reviewRequiredAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session: mongoSession },
    );
    if (refundStatus === 'FULL') {
      await updatePaymentAssignment(
        db,
        session._id,
        'ESTORNADA',
        undefined,
        mongoSession,
      );
    } else {
      await db.collection('pagamentos.atribuicoes').updateOne(
        { compraId: session._id },
        { $set: { refundStatus, updatedAt: new Date() } },
        { session: mongoSession },
      );
    }
    return 'REVIEW_REQUIRED';
  }

  if (isPartialRefundEvent(event)) {
    const partialTransition = await db.collection('pagamentos.sessoes').updateOne(
        {
          _id: session._id,
          status: {
            $in: [
              'OPEN',
              'CREATING_PAYMENT',
              'PAYMENT_PENDING',
              'PAYMENT_REVIEW_REQUIRED',
              'CONFIRMED',
            ],
          },
        },
        {
          $set: {
            refundStatus,
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
    );
    if (partialTransition.modifiedCount !== 1) return false;
    await db.collection('pagamentos.atribuicoes').updateOne(
        { compraId: session._id },
        {
          $set: {
            refundStatus,
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
    );
    return true;
  }

  const transition = await db.collection('pagamentos.sessoes').updateOne(
      {
        _id: session._id,
        status: {
          $in: [
            'OPEN',
            'CREATING_PAYMENT',
            'PAYMENT_PENDING',
            'PAYMENT_REVIEW_REQUIRED',
            'CONFIRMED',
          ],
        },
      },
      {
        $set: {
          status: 'REFUNDED',
          refundStatus: 'FULL',
          terminalAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: { activeKey: '' },
      },
      { session: mongoSession },
  );
  if (transition.modifiedCount !== 1) return 'NOOP';
  await updatePaymentAssignment(db, session._id, 'ESTORNADA', undefined, mongoSession);
  const discountConsumed = await consumeDiscountCode(
    db,
    session._id,
    mongoSession,
    session.codigoDesconto?.codigoId,
  );
  if (session.codigoDesconto && !discountConsumed) {
    throw new Error('O estorno não conseguiu preservar o consumo do desconto.');
  }
  await updateUserRegistrationAfterRefund(
    db,
    session.owner,
    session.edicaoId,
    session._id,
    mongoSession,
  );
  await db.collection('pagamentos.comprovantes').updateOne(
    { compraId: session._id },
    {
      $set: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { session: mongoSession },
  );
  return 'REFUNDED';
}

async function markChargebackPending(db, session, payload, mongoSession) {
  if (session.status !== 'CONFIRMED') return false;
  const chargebackStatus = payload.event === 'PAYMENT_CHARGEBACK_DISPUTE'
    ? 'DISPUTED'
    : 'REQUESTED';
  await db.collection('pagamentos.sessoes').updateOne(
    { _id: session._id, status: 'CONFIRMED' },
    { $set: { chargebackStatus, updatedAt: new Date() } },
    { session: mongoSession },
  );
  await db.collection('pagamentos.atribuicoes').updateOne(
    { compraId: session._id, status: 'CONFIRMADA' },
    { $set: { chargebackStatus, updatedAt: new Date() } },
    { session: mongoSession },
  );
  return true;
}

async function processEvent(db, payload, mongoSession) {
  const event = String(payload?.event || '');
  const correlation = sessionCorrelationFilter(payload);
  const session = correlation
    ? await db.collection('pagamentos.sessoes').findOne(correlation, { session: mongoSession })
    : null;

  if (session) {
    let requiresReview = false;
    let allowLegacyConfirmation = true;
    if (isConfirmedEvent(event, payload.payment)) {
      const confirmationResult = await confirmSessionPayment(
        db,
        session,
        payload,
        mongoSession,
      );
      requiresReview = confirmationResult === 'REVIEW_REQUIRED';
      allowLegacyConfirmation = ['CONFIRMED', 'ALREADY_CONFIRMED'].includes(
        confirmationResult,
      );
    } else if (isNonTerminalDelinquencyEvent(event)) {
      const delinquencyEventAt = new Date();
      const cancellationEligibleAt = cancellationEligibleAtForDelinquency(
        delinquencyEventAt,
        getPaymentOverdueGraceDays(),
        event === 'PAYMENT_BANK_SLIP_CANCELLED',
        payload?.payment?.dueDate,
      );
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: session._id, status: 'PAYMENT_PENDING' },
        {
          $set: {
            gatewayState:
              event === 'PAYMENT_BANK_SLIP_CANCELLED'
                ? 'BANK_SLIP_CANCELLED'
                : 'OVERDUE',
            ...(payload?.payment?.id
              ? { paymentId: String(payload.payment.id) }
              : {}),
            ...(payload?.payment?.invoiceNumber
              ? { invoiceNumber: String(payload.payment.invoiceNumber) }
              : {}),
            updatedAt: delinquencyEventAt,
          },
          $min: {
            overdueAt: delinquencyEventAt,
            cancellationEligibleAt,
          },
        },
        { session: mongoSession },
      );
    } else if (isCancelledEvent(event)) {
      await cancelSessionPayment(db, session, payload, mongoSession);
    } else if (isFullRefundEvent(event) || isPartialRefundEvent(event)) {
      const refundResult = await refundSessionPayment(db, session, payload, mongoSession);
      requiresReview = refundResult === 'REVIEW_REQUIRED';
    } else if (isChargebackPendingEvent(event)) {
      await markChargebackPending(db, session, payload, mongoSession);
    }

    await updateLegacyPayment(
      db,
      payload,
      mongoSession,
      allowLegacyConfirmation,
      false,
    );
    return { sessionId: session._id, edicaoId: session.edicaoId, requiresReview };
  }

  const legacyUpdated = await updateLegacyPayment(db, payload, mongoSession);
  const financiallyRelevant =
    isConfirmedEvent(event, payload.payment) ||
    isCancelledEvent(event) ||
    isFullRefundEvent(event) ||
    isPartialRefundEvent(event) ||
    isChargebackPendingEvent(event) ||
    isNonTerminalDelinquencyEvent(event);
  return {
    requiresReview: financiallyRelevant && !legacyUpdated,
    orphaned: financiallyRelevant && !legacyUpdated,
  };
}

export async function POST(request) {
  /*
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN || process.env.PAYMENT_WEBHOOK_TOKEN;
  const receivedToken =
  request.headers.get('asaas-access-token') || request.headers.get('x-webhook-token');
  
  if (!expectedToken) {
    return Response.json(
      { error: 'webhook_not_configured', message: 'Webhook não configurado.' },
      { status: 503 },
    );
  }
  if (!secureEquals(receivedToken, expectedToken)) {
    return Response.json(
      { error: 'invalid_webhook_token', message: 'Token inválido.' },
      { status: 401 },
    );
  }
  */
  let payload;
  try {
    payload = await request.json();
    console.log(payload)
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { db, client } = await connectToDatabase();
  const claim = await claimEvent(db, payload);
  if (!claim.claimed) {
    return Response.json({ message: 'duplicate_ignored' }, { status: 200 });
  }

  try {
    const result = await runPaymentTransaction(
      client,
      (mongoSession) => processEvent(db, payload, mongoSession),
    );
    const eventStatus = result.requiresReview ? 'REVIEW_REQUIRED' : 'PROCESSED';
    await finishEvent(db, claim.eventId, eventStatus, {
      purchaseId: result.sessionId || null,
      edicaoId: result.edicaoId || null,
      orphaned: Boolean(result.orphaned),
      paymentId: payload?.payment?.id || null,
      customerId: payload?.payment?.customer || null,
    });
    return Response.json(
      { message: result.requiresReview ? 'payment_review_required' : 'success' },
      { status: result.requiresReview ? 202 : 200 },
    );
  } catch (error) {
    console.error('Erro ao processar webhook de pagamento:', error);
    await finishEvent(db, claim.eventId, 'FAILED', {
      lastError: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
    });
    return Response.json({ error: 'webhook_processing_failed' }, { status: 500 });
  }
}
