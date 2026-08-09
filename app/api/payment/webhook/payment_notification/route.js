import { ObjectId } from 'mongodb';
import { after } from 'next/server.js';
import { connectToDatabase } from '../../../../lib/mongodb.js';
import {
  consumeDiscountCode,
  releaseDiscountReservation,
  updatePaymentAssignment,
  updateUserRegistrationAfterRefund,
} from '../../../../lib/payments/codes.ts';
import { runPaymentTransaction } from '../../../../lib/payments/transactions.ts';
import {
  cancellationEligibleAtForDelinquency,
  getPaymentOverdueGraceDays,
} from '../../../../lib/payments/overdue.ts';
import {
  derivePaymentCredential,
  secureEquals,
} from '../../../../lib/payments/webhook-auth.ts';
import { findLegacyPaymentContext } from '../../../../lib/payments/webhook-legacy.ts';
import { asaasRequestHeaders } from '../../../../lib/payments/asaas.ts';
import {
  acquireWebhookWorkerLease,
  claimWebhookEvent,
  ensureWebhookLedgerReady,
  failWebhookEvent,
  finishWebhookEvent,
  getRequiredWebhookEventId,
  holdWebhookWorkerLeaseUntil,
  ingestWebhookEvent,
  releaseWebhookWorkerLease,
} from '../../../../lib/payments/webhook-ledger.ts';

export const maxDuration = 60;

function getEventId(payload) {
  return getRequiredWebhookEventId(payload) || 'missing-event-id';
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
  if (payment.installment) {
    ors.push({ 'installmentPlan.installmentId': String(payment.installment) });
  }
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

function isPixAwaitingReceiptEvent(event, payment) {
  return event === 'PAYMENT_CONFIRMED' &&
    String(payment?.billingType || '').toUpperCase() === 'PIX';
}

function isAccessGrantingEvent(event, payment) {
  return isConfirmedEvent(event, payment) && !isPixAwaitingReceiptEvent(event, payment);
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
  return event === 'PAYMENT_REFUNDED';
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

const PAYMENT_FAILURE_EVENTS = new Set([
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
]);

const MANUAL_REVIEW_EVENTS = new Set([
  'PAYMENT_RESTORED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
]);

export const OFFICIAL_RELEVANT_PAYMENT_EVENTS = Object.freeze([
  'PAYMENT_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_BANK_SLIP_CANCELLED',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUND_DENIED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  'PAYMENT_RESTORED',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
]);

export const OFFICIAL_RELEVANT_CHECKOUT_EVENTS = Object.freeze([
  'CHECKOUT_CREATED',
  'CHECKOUT_PAID',
  'CHECKOUT_CANCELED',
  'CHECKOUT_EXPIRED',
]);

const OFFICIAL_RELEVANT_PAYMENT_EVENT_SET = new Set(OFFICIAL_RELEVANT_PAYMENT_EVENTS);
const OFFICIAL_RELEVANT_CHECKOUT_EVENT_SET = new Set(OFFICIAL_RELEVANT_CHECKOUT_EVENTS);

class WebhookReviewError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'WebhookReviewError';
    this.reason = reason;
  }
}

function assignmentCorrelationFilter(payload) {
  const payment = payload?.payment || {};
  const checkout = payload?.checkout || {};
  const ors = [];
  const references = [payment.externalReference, checkout.externalReference].filter(Boolean);

  for (const reference of references) {
    if (ObjectId.isValid(String(reference))) {
      ors.push({ compraId: new ObjectId(String(reference)) });
    }
  }
  if (payment.id) ors.push({ 'pagamento.paymentId': String(payment.id) });
  if (payment.invoiceNumber) {
    ors.push({ 'pagamento.invoiceNumber': String(payment.invoiceNumber) });
  }
  for (const checkoutId of [payment.checkoutSession, checkout.id].filter(Boolean)) {
    ors.push({ 'pagamento.checkoutId': String(checkoutId) });
  }
  if (payment.installment) {
    ors.push({ 'installmentPlan.installmentId': String(payment.installment) });
  }

  return ors.length ? { $or: ors } : null;
}

function isFinanciallyRelevantEvent(event, payment) {
  return isConfirmedEvent(event, payment) ||
    OFFICIAL_RELEVANT_PAYMENT_EVENT_SET.has(event) ||
    OFFICIAL_RELEVANT_CHECKOUT_EVENT_SET.has(event) ||
    isCancelledEvent(event);
}

function sameOptionalIdentifier(expected, received) {
  return !expected || (received != null && String(expected) === String(received));
}

function paymentValueInCents(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function normalizeRefundsSnapshot(payment, capturedAt = new Date()) {
  const rawRefunds = Array.isArray(payment?.refunds) ? payment.refunds : [];
  const items = rawRefunds.map((rawRefund) => {
    const valueCentavos = Math.max(0, paymentValueInCents(rawRefund?.value) ?? 0);
    return {
      value: valueCentavos / 100,
      valueCentavos,
      status: String(rawRefund?.status || 'UNKNOWN').trim().toUpperCase(),
      dateCreated:
        typeof rawRefund?.dateCreated === 'string' && rawRefund.dateCreated.trim()
          ? rawRefund.dateCreated.trim()
          : null,
      transactionReceiptUrl:
        typeof rawRefund?.transactionReceiptUrl === 'string' &&
        rawRefund.transactionReceiptUrl.trim()
          ? rawRefund.transactionReceiptUrl.trim()
          : null,
    };
  });
  const totalDoneCentavos = items.reduce(
    (total, refund) => refund.status === 'DONE' ? total + refund.valueCentavos : total,
    0,
  );

  return {
    items,
    totalDone: totalDoneCentavos / 100,
    totalDoneCentavos,
    capturedAt,
  };
}

function installmentMatchesSession(session, payment) {
  if (!session?.installmentPlan) return !payment?.installment;
  if (!session.installmentPlan.installmentId) return false;
  return Boolean(
    payment?.installment &&
    String(payment.installment) === String(session.installmentPlan.installmentId),
  );
}

async function hydrateProvisionalInstallmentPlan(db, session, payload, mongoSession) {
  const payment = payload?.payment || {};
  const plan = session?.installmentPlan;
  if (!plan) {
    return {
      ready: !payment.installment,
      reason: payment.installment ? 'PAYMENT_INSTALLMENT_MISMATCH' : null,
    };
  }
  if (plan.installmentId) {
    const ready = installmentMatchesSession(session, payment);
    return { ready, reason: ready ? null : 'PAYMENT_INSTALLMENT_MISMATCH' };
  }

  const installmentId = String(payment.installment || '').trim();
  const externalReference = String(payment.externalReference || '').trim();
  const expectedCents = Number(plan.installmentValueCentavos);
  const receivedCents = paymentValueInCents(payment.value);
  if (
    !installmentId ||
    externalReference !== String(session._id) ||
    Number(plan.count) < 2 ||
    !Number.isInteger(expectedCents) ||
    receivedCents !== expectedCents ||
    String(payment.billingType || '').toUpperCase() !== 'CREDIT_CARD'
  ) {
    return { ready: false, reason: 'PAYMENT_INSTALLMENT_MISMATCH' };
  }

  const owner = await db.collection('usuarios').findOne(
    { _id: session.owner },
    { projection: { id_api: 1 }, session: mongoSession },
  );
  if (
    !payment.customer ||
    !owner?.id_api ||
    String(payment.customer) !== String(owner.id_api)
  ) {
    return { ready: false, reason: 'PAYMENT_CUSTOMER_MISMATCH' };
  }

  const now = new Date();
  const sessionFields = {
    'installmentPlan.installmentId': installmentId,
    ...(payment.id ? { paymentId: String(payment.id) } : {}),
    ...(payment.invoiceNumber ? { invoiceNumber: String(payment.invoiceNumber) } : {}),
    updatedAt: now,
  };
  const assignmentFields = {
    'installmentPlan.installmentId': installmentId,
    ...(payment.id ? { 'pagamento.paymentId': String(payment.id) } : {}),
    ...(payment.invoiceNumber
      ? { 'pagamento.invoiceNumber': String(payment.invoiceNumber) }
      : {}),
    updatedAt: now,
  };
  const [sessionUpdate, assignmentUpdate] = await Promise.all([
    db.collection('pagamentos.sessoes').updateOne(
      {
        _id: session._id,
        'installmentPlan.count': Number(plan.count),
        'installmentPlan.totalValueCentavos': Number(plan.totalValueCentavos),
        'installmentPlan.installmentValueCentavos': expectedCents,
        $or: [
          { 'installmentPlan.installmentId': null },
          { 'installmentPlan.installmentId': '' },
          { 'installmentPlan.installmentId': { $exists: false } },
        ],
      },
      { $set: sessionFields },
      { session: mongoSession },
    ),
    db.collection('pagamentos.atribuicoes').updateOne(
      {
        compraId: session._id,
        usuarioId: session.owner,
        'installmentPlan.count': Number(plan.count),
        'installmentPlan.totalValueCentavos': Number(plan.totalValueCentavos),
        'installmentPlan.installmentValueCentavos': expectedCents,
      },
      { $set: assignmentFields },
      { session: mongoSession },
    ),
  ]);
  if (sessionUpdate.matchedCount !== 1 || assignmentUpdate.matchedCount !== 1) {
    return { ready: false, reason: 'PAYMENT_INSTALLMENT_MISMATCH' };
  }

  session.installmentPlan = { ...plan, installmentId };
  if (!session.paymentId && payment.id) session.paymentId = String(payment.id);
  if (!session.invoiceNumber && payment.invoiceNumber) {
    session.invoiceNumber = String(payment.invoiceNumber);
  }
  return { ready: true, reason: null };
}

function installmentPaymentObservation(payload, observedAt = new Date()) {
  const payment = payload?.payment || {};
  return {
    paymentId: payment.id ? String(payment.id) : null,
    invoiceNumber: payment.invoiceNumber ? String(payment.invoiceNumber) : null,
    installmentNumber: Number.isInteger(Number(payment.installmentNumber))
      ? Number(payment.installmentNumber)
      : null,
    status: String(payment.status || payload?.event || 'UNKNOWN'),
    value: (paymentValueInCents(payment.value) ?? 0) / 100,
    valueCentavos: paymentValueInCents(payment.value) ?? 0,
    lastEvent: String(payload?.event || 'UNKNOWN'),
    lastEventId: getEventId(payload),
    observedAt,
  };
}

async function recordInstallmentPayment(db, session, payload, mongoSession) {
  if (!session?.installmentPlan || !installmentMatchesSession(session, payload?.payment)) return;
  const observation = installmentPaymentObservation(payload);
  if (!observation.paymentId) return;
  const previous = Array.isArray(session.installmentPlan.observedPayments)
    ? session.installmentPlan.observedPayments
    : [];
  const observedPayments = [
    ...previous.filter((item) => String(item?.paymentId || '') !== observation.paymentId),
    observation,
  ];
  await Promise.all([
    db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id },
      { $set: { 'installmentPlan.observedPayments': observedPayments, updatedAt: new Date() } },
      { session: mongoSession },
    ),
    db.collection('pagamentos.atribuicoes').updateOne(
      { compraId: session._id },
      { $set: { 'installmentPlan.observedPayments': observedPayments, updatedAt: new Date() } },
      { session: mongoSession },
    ),
  ]);
}

function installmentRefundProgress(session, payment, refundsSnapshot) {
  const paymentId = String(payment?.id || 'unknown-payment');
  const previous = Array.isArray(session?.installmentPlan?.refundsByPayment)
    ? session.installmentPlan.refundsByPayment
    : [];
  const refundsByPayment = [
    ...previous.filter((item) => String(item?.paymentId || '') !== paymentId),
    { paymentId, refundsSnapshot },
  ];
  const totalDoneCentavos = refundsByPayment.reduce(
    (total, item) => total + Number(item?.refundsSnapshot?.totalDoneCentavos || 0),
    0,
  );
  return { refundsByPayment, totalDoneCentavos };
}

async function markSessionForReview(db, session, reason, mongoSession) {
  await db.collection('pagamentos.sessoes').updateOne(
    { _id: session._id },
    {
      $set: {
        status: ['CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(session.status)
          ? session.status
          : 'PAYMENT_REVIEW_REQUIRED',
        gatewayState: 'PAYMENT_REVIEW_REQUIRED',
        reconciliationReason: reason,
        reviewRequiredAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { session: mongoSession },
  );
}

async function markFinancialEventForReview(
  db,
  session,
  event,
  reason,
  mongoSession,
  sessionFields = {},
  assignmentFields = {},
) {
  const now = new Date();
  await Promise.all([
    db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id },
      {
        $set: {
          status: ['CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(session.status)
            ? session.status
            : 'PAYMENT_REVIEW_REQUIRED',
          gatewayState: event,
          reconciliationReason: reason,
          financialReviewEvent: event,
          reviewRequiredAt: now,
          updatedAt: now,
          ...sessionFields,
        },
      },
      { session: mongoSession },
    ),
    db.collection('pagamentos.atribuicoes').updateOne(
      { compraId: session._id },
      {
        $set: {
          gatewayState: event,
          reconciliationReason: reason,
          financialReviewEvent: event,
          reviewRequiredAt: now,
          updatedAt: now,
          ...assignmentFields,
        },
      },
      { session: mongoSession },
    ),
  ]);
}

export async function updateLegacyPayment(
  db,
  payload,
  mongoSession,
  allowConfirmedTransition = true,
  manageLegacyTicketRefund = true,
) {
  const event = String(payload?.event || '');
  const payment = payload?.payment || {};
  const legacyContext = await findLegacyPaymentContext(db, payment, mongoSession);
  if (!legacyContext) return false;
  const { user, storedPayment, match, matchKey, matchValues } = legacyContext;
  const storedStatus = String(storedPayment?.status || '');
  if (
    (isAccessGrantingEvent(event, payment) && storedStatus === 'PAYMENT_REFUNDED') ||
    (isNonTerminalDelinquencyEvent(event) &&
      ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CONFIRMED', 'RECEIVED'].includes(storedStatus))
  ) {
    return true;
  }
  let replacementAssignment = null;
  let hasOtherConfirmedLegacyTicket = false;
  if (
    manageLegacyTicketRefund &&
    (isFullRefundEvent(event) || event === 'PAYMENT_DELETED') &&
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
    const update = { $pull: { 'pagamento.lista_pagamentos': match } };
    if (manageLegacyTicketRefund && storedPayment?._type === 'ticket') {
      if (replacementAssignment) {
        update.$set = {
          'pagamento.situacao': 1,
          'pagamento.edicaoId': replacementAssignment.edicaoId,
          'pagamento.compraId': replacementAssignment.compraId,
        };
      } else if (!hasOtherConfirmedLegacyTicket) {
        update.$set = { 'pagamento.situacao': 0 };
      }
    }
    await db.collection('usuarios').updateOne(
      { _id: user._id },
      update,
      { session: mongoSession },
    );
    if (
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

  const set = {
    'pagamento.lista_pagamentos.$[payment].status': event,
    'pagamento.lista_pagamentos.$[payment].lastWebhookEventId': getEventId(payload),
    'pagamento.lista_pagamentos.$[payment].lastWebhookAt': new Date(),
  };
  if (
    allowConfirmedTransition &&
    isAccessGrantingEvent(event, payment) &&
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
        { [`payment.${matchKey}`]: { $in: matchValues } },
      ],
      session: mongoSession,
    },
  );

  if (storedPayment?._type === 'activity' && ObjectId.isValid(String(storedPayment?._eventID))) {
    if (isAccessGrantingEvent(event, payment)) {
      await db.collection('minicursos').updateOne(
        { _id: new ObjectId(storedPayment._eventID) },
        { $addToSet: { participants: storedPayment._userId } },
        { session: mongoSession },
      );
    } else if (isCancelledEvent(event) || isFullRefundEvent(event)) {
      await db.collection('minicursos').updateOne(
        { _id: new ObjectId(storedPayment._eventID) },
        { $pull: { participants: storedPayment._userId } },
        { session: mongoSession },
      );
    }
  }
  return true;
}

async function validateSessionPayment(db, session, payload, mongoSession) {
  const payment = payload?.payment || {};
  const checkout = payload?.checkout || {};
  const [user, assignment] = await Promise.all([
    db.collection('usuarios').findOne(
      { _id: session.owner },
      { projection: { _id: 1, id_api: 1 }, session: mongoSession },
    ),
    db.collection('pagamentos.atribuicoes').findOne(
      { compraId: session._id },
      {
        projection: {
          _id: 1,
          status: 1,
          usuarioId: 1,
          valorSelecionadoCentavos: 1,
          valoresCentavos: 1,
          pagamento: 1,
          installmentPlan: 1,
        },
        session: mongoSession,
      },
    ),
  ]);
  const reasons = [];

  if (session.type !== 'ticket') reasons.push('SESSION_TYPE_MISMATCH');
  if (!user) reasons.push('SESSION_OWNER_NOT_FOUND');
  if (!assignment) reasons.push('PAYMENT_ASSIGNMENT_NOT_FOUND');
  if (assignment && String(assignment.usuarioId) !== String(session.owner)) {
    reasons.push('PAYMENT_ASSIGNMENT_OWNER_MISMATCH');
  }
  if (!payment.customer || !user?.id_api || String(payment.customer) !== String(user.id_api)) {
    reasons.push('PAYMENT_CUSTOMER_MISMATCH');
  }
  if (!installmentMatchesSession(session, payment)) {
    reasons.push('PAYMENT_INSTALLMENT_MISMATCH');
  }
  if (
    payment.externalReference &&
    String(payment.externalReference) !== String(session._id)
  ) {
    reasons.push('PAYMENT_EXTERNAL_REFERENCE_MISMATCH');
  }
  if (
    checkout.externalReference &&
    String(checkout.externalReference) !== String(session._id)
  ) {
    reasons.push('CHECKOUT_EXTERNAL_REFERENCE_MISMATCH');
  }

  const expectedCents = Number(
    session.installmentPlan?.installmentValueCentavos ??
      assignment?.installmentPlan?.installmentValueCentavos ??
      session.valorSelecionadoCentavos?.final ??
      assignment?.valorSelecionadoCentavos?.final ??
      assignment?.valoresCentavos?.final?.[session.metodoPagamento],
  );
  const receivedCents = paymentValueInCents(payment.value);
  if (!Number.isInteger(expectedCents) || receivedCents === null || expectedCents !== receivedCents) {
    reasons.push('PAYMENT_VALUE_MISMATCH');
  }

  if (
    !session.metodoPagamento ||
    !payment.billingType ||
    String(session.metodoPagamento) !== String(payment.billingType)
  ) {
    reasons.push('PAYMENT_METHOD_MISMATCH');
  }
  if (!session.installmentPlan && !sameOptionalIdentifier(session.paymentId, payment.id)) {
    reasons.push('PAYMENT_ID_MISMATCH');
  }
  if (!session.installmentPlan && !sameOptionalIdentifier(session.invoiceNumber, payment.invoiceNumber)) {
    reasons.push('PAYMENT_INVOICE_MISMATCH');
  }
  if (!sameOptionalIdentifier(session.orderId, payment.checkoutSession)) {
    reasons.push('PAYMENT_CHECKOUT_MISMATCH');
  }

  if (reasons.length) {
    await markSessionForReview(db, session, reasons.join(','), mongoSession);
    return false;
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

  if (!(await validateSessionPayment(db, session, payload, mongoSession))) {
    return 'REVIEW_REQUIRED';
  }

  if (session.status === 'CONFIRMED') {
    if (session.chargebackStatus === 'AWAITING_REVERSAL') {
      const resolved = await resolveWonChargeback(db, session, payload, mongoSession);
      return resolved ? 'CHARGEBACK_RESOLVED' : 'CONFIRMED_REVIEW_REQUIRED';
    }
    return 'ALREADY_CONFIRMED';
  }

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
      $unset: {
        activeKey: '',
        financialReviewEvent: '',
        reconciliationReason: '',
        reviewRequiredAt: '',
        pixSettlementStatus: '',
      },
    },
    { session: mongoSession },
  );
  if (transition.modifiedCount !== 1) return 'NOOP';

  const userUpdate = await db.collection('usuarios').updateOne(
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
  if (userUpdate.matchedCount !== 1) {
    throw new Error('PAYMENT_SESSION_OWNER_UPDATE_FAILED');
  }
  const assignmentUpdated = await updatePaymentAssignment(db, session._id, 'CONFIRMADA', {
      metodo: payment.billingType || session.metodoPagamento,
      checkoutId: payment.checkoutSession || session.orderId,
      paymentId: payment.id || session.paymentId,
      invoiceNumber: payment.invoiceNumber || session.invoiceNumber,
    }, mongoSession);
  if (!assignmentUpdated) {
    throw new Error('PAYMENT_ASSIGNMENT_UPDATE_FAILED');
  }
  await db.collection('pagamentos.atribuicoes').updateOne(
    { compraId: session._id },
    {
      $unset: {
        financialReviewEvent: '',
        reconciliationReason: '',
        reviewRequiredAt: '',
        pixSettlementStatus: '',
      },
    },
    { session: mongoSession },
  );
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
    await db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id, status: 'CONFIRMED' },
      {
        $set: {
          reconciliationReason: 'DISCOUNT_CONSUMPTION_MISMATCH',
          reviewRequiredAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session: mongoSession },
    );
    return 'CONFIRMED_REVIEW_REQUIRED';
  }
  return 'CONFIRMED';
}

async function cancelSessionPayment(db, session, payload, mongoSession) {
  if (['CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(session.status)) {
    return 'TERMINAL_IGNORED';
  }
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
    const [discountReleased, assignmentUpdated] = await Promise.all([
      releaseDiscountReservation(db, session._id, mongoSession),
      updatePaymentAssignment(db, session._id, assignmentStatus, undefined, mongoSession),
    ]);
    await db.collection('usuarios').updateOne(
        { _id: session.owner, 'pagamento.situacao': { $ne: 1 } },
        { $set: { 'pagamento.situacao': 0 } },
        { session: mongoSession },
    );
    const reconciliationReasons = [
      ...(!assignmentUpdated ? ['PAYMENT_ASSIGNMENT_NOT_FOUND'] : []),
      ...(session.codigoDesconto && !discountReleased
        ? ['DISCOUNT_RELEASE_MISMATCH']
        : []),
    ];
    if (reconciliationReasons.length) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: session._id, status },
        {
          $set: {
            reconciliationReason: reconciliationReasons.join(','),
            reviewRequiredAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
      );
      return 'REVIEW_REQUIRED';
    }
    return 'CANCELLED';
  }
  return 'NOOP';
}

async function refundSessionPayment(db, session, payload, mongoSession) {
  const event = String(payload.event || '');
  const now = new Date();
  const refundsSnapshot = normalizeRefundsSnapshot(payload?.payment, now);
  const planRefundProgress = session.installmentPlan
    ? installmentRefundProgress(session, payload?.payment, refundsSnapshot)
    : null;
  const planFullyRefunded = Boolean(
    planRefundProgress &&
    planRefundProgress.totalDoneCentavos >= Number(session.installmentPlan.totalValueCentavos),
  );
  const refundStatus = planFullyRefunded
    ? 'FULL'
    : event === 'PAYMENT_PARTIALLY_REFUNDED'
      ? 'PARTIAL'
      : event === 'PAYMENT_REFUND_IN_PROGRESS'
        ? 'IN_PROGRESS'
        : 'FULL';
  const refundFields = {
    gatewayState: event,
    refundStatus,
    refundsSnapshot,
    ...(planRefundProgress
      ? {
          'installmentPlan.refundsByPayment': planRefundProgress.refundsByPayment,
          'installmentPlan.refundTotalDoneCentavos': planRefundProgress.totalDoneCentavos,
        }
      : {}),
    updatedAt: now,
  };

  if (session.status === 'REFUNDED') return 'ALREADY_REFUNDED';

  if (planRefundProgress && !planFullyRefunded) {
    await markFinancialEventForReview(
      db,
      session,
      event,
      'INSTALLMENT_PLAN_REFUND_INCOMPLETE',
      mongoSession,
      { ...refundFields, refundStatus: 'PARTIAL_PLAN' },
      { ...refundFields, refundStatus: 'PARTIAL_PLAN' },
    );
    return 'REVIEW_REQUIRED';
  }

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
          ...refundFields,
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
    await db.collection('pagamentos.atribuicoes').updateOne(
      { compraId: session._id },
      {
        $set: {
          ...(refundStatus === 'FULL' ? { status: 'ESTORNADA', refundedAt: now } : {}),
          ...refundFields,
        },
      },
      { session: mongoSession },
    );
    return 'REVIEW_REQUIRED';
  }

  if (isPartialRefundEvent(event) && !planFullyRefunded) {
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
            ...refundFields,
          },
        },
        { session: mongoSession },
    );
    if (partialTransition.modifiedCount !== 1) return false;
    const assignmentUpdate = await db.collection('pagamentos.atribuicoes').updateOne(
        { compraId: session._id },
        {
          $set: {
            ...refundFields,
          },
        },
        { session: mongoSession },
    );
    if (assignmentUpdate.matchedCount !== 1) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: session._id },
        {
          $set: {
            reconciliationReason: 'PAYMENT_ASSIGNMENT_NOT_FOUND',
            reviewRequiredAt: now,
            updatedAt: now,
          },
        },
        { session: mongoSession },
      );
      return 'REVIEW_REQUIRED';
    }
    return 'PARTIAL_REFUND_RECORDED';
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
          ...refundFields,
          terminalAt: now,
        },
        $unset: { activeKey: '' },
      },
      { session: mongoSession },
  );
  if (transition.modifiedCount !== 1) return 'NOOP';
  const assignmentTransition = await db.collection('pagamentos.atribuicoes').updateOne(
    { compraId: session._id },
    {
      $set: {
        status: 'ESTORNADA',
        ...refundFields,
        refundedAt: now,
      },
    },
    { session: mongoSession },
  );
  const assignmentUpdated = assignmentTransition.matchedCount === 1;
  const discountConsumed = await consumeDiscountCode(
    db,
    session._id,
    mongoSession,
    session.codigoDesconto?.codigoId,
  );
  const reconciliationReasons = [
    ...(!assignmentUpdated ? ['PAYMENT_ASSIGNMENT_NOT_FOUND'] : []),
    ...(session.codigoDesconto && !discountConsumed
      ? ['REFUND_DISCOUNT_RECONCILIATION_MISMATCH']
      : []),
  ];
  const requiresReview = reconciliationReasons.length > 0;
  if (requiresReview) {
    await db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id, status: 'REFUNDED' },
      {
        $set: {
          reconciliationReason: reconciliationReasons.join(','),
          reviewRequiredAt: now,
          updatedAt: now,
        },
      },
      { session: mongoSession },
    );
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
        refundedAt: now,
        updatedAt: now,
      },
    },
    { session: mongoSession },
  );
  return requiresReview ? 'REVIEW_REQUIRED' : 'REFUNDED';
}

async function recordCreatedCheckout(db, session, payload, mongoSession) {
  const checkout = payload?.checkout || {};
  if (!checkout.id) {
    await markSessionForReview(db, session, 'CHECKOUT_ID_MISSING', mongoSession);
    return 'REVIEW_REQUIRED';
  }
  if (
    session.type !== 'ticket' ||
    (session.metodoPagamento && session.metodoPagamento !== 'PIX') ||
    (checkout.externalReference && String(checkout.externalReference) !== String(session._id))
  ) {
    await markSessionForReview(db, session, 'CHECKOUT_CORRELATION_MISMATCH', mongoSession);
    return 'REVIEW_REQUIRED';
  }
  const now = new Date();
  const transition = await db.collection('pagamentos.sessoes').updateOne(
    {
      _id: session._id,
      status: { $in: ['OPEN', 'CREATING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
    },
    {
      $set: {
        status: 'PAYMENT_PENDING',
        gatewayState: 'CHECKOUT_CREATED',
        orderId: String(checkout.id),
        paymentUrl: checkout.link || checkout.url || session.paymentUrl || null,
        updatedAt: now,
      },
    },
    { session: mongoSession },
  );
  if (transition.matchedCount !== 1) {
    await markSessionForReview(db, session, `CHECKOUT_CREATED_AFTER_${session.status}`, mongoSession);
    return 'REVIEW_REQUIRED';
  }
  const assignmentUpdated = await updatePaymentAssignment(
    db,
    session._id,
    'PAGAMENTO_PENDENTE',
    { metodo: 'PIX', checkoutId: String(checkout.id) },
    mongoSession,
  );
  if (!assignmentUpdated) {
    await markSessionForReview(db, session, 'PAYMENT_ASSIGNMENT_NOT_FOUND', mongoSession);
    return 'REVIEW_REQUIRED';
  }
  return 'RECORDED';
}

async function handleRefundDenied(db, session, payload, mongoSession) {
  const refundsSnapshot = normalizeRefundsSnapshot(payload?.payment);
  const planRefundProgress = session.installmentPlan
    ? installmentRefundProgress(session, payload?.payment, refundsSnapshot)
    : null;
  const refundStatus = session.status === 'REFUNDED' || session.refundStatus === 'FULL'
    ? 'FULL'
    : refundsSnapshot.totalDoneCentavos > 0 ||
        Number(planRefundProgress?.totalDoneCentavos || 0) > 0 ||
        session.refundStatus === 'PARTIAL'
      ? 'PARTIAL'
      : 'DENIED';
  const planFields = planRefundProgress
    ? {
        'installmentPlan.refundsByPayment': planRefundProgress.refundsByPayment,
        'installmentPlan.refundTotalDoneCentavos': planRefundProgress.totalDoneCentavos,
      }
    : {};

  await markFinancialEventForReview(
    db,
    session,
    'PAYMENT_REFUND_DENIED',
    'PAYMENT_REFUND_DENIED',
    mongoSession,
    {
      refundStatus,
      refundAttemptStatus: 'DENIED',
      refundsSnapshot,
      ...planFields,
    },
    {
      refundStatus,
      refundAttemptStatus: 'DENIED',
      refundsSnapshot,
      ...planFields,
    },
  );
  return 'REVIEW_REQUIRED';
}

async function markChargebackPending(db, session, payload, mongoSession) {
  const chargebackStatus = payload.event === 'PAYMENT_CHARGEBACK_DISPUTE'
    ? 'DISPUTED'
    : 'REQUESTED';
  if (session.status !== 'CONFIRMED') {
    await markFinancialEventForReview(
      db,
      session,
      payload.event,
      `${payload.event}_AFTER_${session.status}`,
      mongoSession,
      { chargebackStatus },
      { chargebackStatus },
    );
    return 'REVIEW_REQUIRED';
  }

  const now = new Date();
  const [, assignmentUpdate] = await Promise.all([
    db.collection('pagamentos.sessoes').updateOne(
      { _id: session._id, status: 'CONFIRMED' },
      { $set: { chargebackStatus, gatewayState: payload.event, updatedAt: now } },
      { session: mongoSession },
    ),
    db.collection('pagamentos.atribuicoes').updateOne(
      { compraId: session._id, status: 'CONFIRMADA' },
      { $set: { chargebackStatus, gatewayState: payload.event, updatedAt: now } },
      { session: mongoSession },
    ),
  ]);
  if (assignmentUpdate.matchedCount !== 1) {
    await markSessionForReview(db, session, 'PAYMENT_ASSIGNMENT_NOT_FOUND', mongoSession);
    return 'REVIEW_REQUIRED';
  }
  return 'RECORDED';
}

async function markChargebackAwaitingReversal(db, session, payload, mongoSession) {
  await markFinancialEventForReview(
    db,
    session,
    payload.event,
    'CHARGEBACK_DISPUTE_WON_AWAITING_REVERSAL',
    mongoSession,
    {
      chargebackStatus: 'AWAITING_REVERSAL',
      chargebackResolution: 'WON_PENDING_SETTLEMENT',
    },
    {
      chargebackStatus: 'AWAITING_REVERSAL',
      chargebackResolution: 'WON_PENDING_SETTLEMENT',
    },
  );
  return 'REVIEW_REQUIRED';
}

async function resolveWonChargeback(db, session, payload, mongoSession) {
  if (session.chargebackStatus !== 'AWAITING_REVERSAL') return false;
  const now = new Date();
  const commonSet = {
    chargebackResolution: 'WON',
    chargebackResolvedAt: now,
    chargebackResolvedByEventId: getEventId(payload),
    gatewayState: payload?.payment?.status || payload.event,
    updatedAt: now,
  };
  const assignmentUpdate = await db.collection('pagamentos.atribuicoes').updateOne(
    { compraId: session._id },
    {
      $set: commonSet,
      $unset: {
        chargebackStatus: '',
        financialReviewEvent: '',
        reconciliationReason: '',
        reviewRequiredAt: '',
      },
    },
    { session: mongoSession },
  );
  if (assignmentUpdate.matchedCount !== 1) {
    await markSessionForReview(db, session, 'PAYMENT_ASSIGNMENT_NOT_FOUND', mongoSession);
    return false;
  }

  const sessionUpdate = await db.collection('pagamentos.sessoes').updateOne(
    { _id: session._id, status: 'CONFIRMED', chargebackStatus: 'AWAITING_REVERSAL' },
    {
      $set: commonSet,
      $unset: {
        chargebackStatus: '',
        financialReviewEvent: '',
        reconciliationReason: '',
        reviewRequiredAt: '',
      },
    },
    { session: mongoSession },
  );
  return sessionUpdate.modifiedCount === 1;
}

async function handlePaymentFailure(db, session, payload, mongoSession) {
  const event = String(payload.event || '');
  if (!['CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(session.status)) {
    const cancellationResult = await cancelSessionPayment(db, session, payload, mongoSession);
    if (cancellationResult === 'CANCELLED') {
      const now = new Date();
      await Promise.all([
        db.collection('pagamentos.sessoes').updateOne(
          { _id: session._id, status: 'CANCELLED' },
          { $set: { gatewayState: event, paymentFailureStatus: event, updatedAt: now } },
          { session: mongoSession },
        ),
        db.collection('pagamentos.atribuicoes').updateOne(
          { compraId: session._id },
          { $set: { gatewayState: event, paymentFailureStatus: event, updatedAt: now } },
          { session: mongoSession },
        ),
      ]);
      return 'CANCELLED';
    }
    if (cancellationResult === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  }

  await markFinancialEventForReview(
    db,
    session,
    event,
    `${event}_AFTER_${session.status}`,
    mongoSession,
    { paymentFailureStatus: event },
    { paymentFailureStatus: event },
  );
  return 'REVIEW_REQUIRED';
}

async function handleManualReviewEvent(db, session, payload, mongoSession) {
  const event = String(payload.event || '');
  const stateFields = event === 'PAYMENT_RESTORED'
    ? { restorationStatus: 'RESTORED_UNCONFIRMED' }
    : { cashReceiptStatus: 'UNDONE' };
  await markFinancialEventForReview(
    db,
    session,
    event,
    `MANUAL_FINANCIAL_REVIEW:${event}`,
    mongoSession,
    stateFields,
    stateFields,
  );
  return 'REVIEW_REQUIRED';
}

export async function processEvent(db, payload, mongoSession) {
  const event = String(payload?.event || '');
  const correlation = sessionCorrelationFilter(payload);
  const session = correlation
    ? await db.collection('pagamentos.sessoes').findOne(correlation, { session: mongoSession })
    : null;

  if (session) {
    let requiresReview = false;
    let reviewReason = null;
    let allowLegacyConfirmation = true;
    const installmentHydration = await hydrateProvisionalInstallmentPlan(
      db,
      session,
      payload,
      mongoSession,
    );
    if (
      !installmentHydration.ready ||
      !installmentMatchesSession(session, payload?.payment)
    ) {
      reviewReason = installmentHydration.reason || 'PAYMENT_INSTALLMENT_MISMATCH';
      await markFinancialEventForReview(
        db,
        session,
        event,
        reviewReason,
        mongoSession,
      );
      return {
        sessionId: session._id,
        edicaoId: session.edicaoId,
        requiresReview: true,
        reviewReason,
      };
    }
    await recordInstallmentPayment(db, session, payload, mongoSession);
    if (isPixAwaitingReceiptEvent(event, payload.payment)) {
      const now = new Date();
      await Promise.all([
        db.collection('pagamentos.sessoes').updateOne(
          { _id: session._id, status: 'PAYMENT_PENDING' },
          {
            $set: {
              gatewayState: event,
              pixSettlementStatus: 'CONFIRMED_AWAITING_RECEIPT',
              updatedAt: now,
            },
          },
          { session: mongoSession },
        ),
        db.collection('pagamentos.atribuicoes').updateOne(
          { compraId: session._id, status: 'PAGAMENTO_PENDENTE' },
          {
            $set: {
              gatewayState: event,
              pixSettlementStatus: 'CONFIRMED_AWAITING_RECEIPT',
              updatedAt: now,
            },
          },
          { session: mongoSession },
        ),
      ]);
      allowLegacyConfirmation = false;
    } else if (isConfirmedEvent(event, payload.payment)) {
      const confirmationResult = await confirmSessionPayment(
        db,
        session,
        payload,
        mongoSession,
      );
      requiresReview = ['REVIEW_REQUIRED', 'CONFIRMED_REVIEW_REQUIRED'].includes(
        confirmationResult,
      );
      if (requiresReview) {
        reviewReason = confirmationResult === 'CONFIRMED_REVIEW_REQUIRED'
          ? session.chargebackStatus === 'AWAITING_REVERSAL'
            ? 'CHARGEBACK_RESOLUTION_REQUIRES_REVIEW'
            : 'DISCOUNT_CONSUMPTION_MISMATCH'
          : 'PAYMENT_CONFIRMATION_VALIDATION_FAILED';
      }
      allowLegacyConfirmation = [
        'CONFIRMED',
        'ALREADY_CONFIRMED',
        'CONFIRMED_REVIEW_REQUIRED',
        'CHARGEBACK_RESOLVED',
      ].includes(
        confirmationResult,
      );
    } else if (event === 'CHECKOUT_CREATED') {
      const checkoutResult = await recordCreatedCheckout(db, session, payload, mongoSession);
      requiresReview = checkoutResult === 'REVIEW_REQUIRED';
      if (requiresReview) reviewReason = 'CHECKOUT_CREATED_REQUIRES_REVIEW';
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
      const cancellationResult = await cancelSessionPayment(
        db,
        session,
        payload,
        mongoSession,
      );
      if (cancellationResult === 'REVIEW_REQUIRED') {
        requiresReview = true;
        reviewReason = 'PAYMENT_CANCELLATION_REQUIRES_REVIEW';
      } else if (
        cancellationResult === 'TERMINAL_IGNORED' &&
        ['CONFIRMED', 'REFUNDED'].includes(session.status)
      ) {
        reviewReason = `CANCELLATION_AFTER_${session.status}`;
        await markSessionForReview(db, session, reviewReason, mongoSession);
        requiresReview = true;
      }
    } else if (isFullRefundEvent(event) || isPartialRefundEvent(event)) {
      if (!(await validateSessionPayment(db, session, payload, mongoSession))) {
        requiresReview = true;
        reviewReason = 'PAYMENT_REFUND_VALIDATION_FAILED';
      } else {
        const refundResult = await refundSessionPayment(db, session, payload, mongoSession);
        requiresReview = refundResult === 'REVIEW_REQUIRED';
        if (requiresReview) reviewReason = 'PAYMENT_REFUND_REQUIRES_REVIEW';
      }
    } else if (event === 'PAYMENT_REFUND_DENIED') {
      await handleRefundDenied(db, session, payload, mongoSession);
      requiresReview = true;
      reviewReason = 'PAYMENT_REFUND_DENIED';
    } else if (isChargebackPendingEvent(event)) {
      const chargebackResult = await markChargebackPending(db, session, payload, mongoSession);
      requiresReview = chargebackResult === 'REVIEW_REQUIRED';
      if (requiresReview) reviewReason = 'PAYMENT_CHARGEBACK_REQUIRES_REVIEW';
    } else if (event === 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL') {
      await markChargebackAwaitingReversal(db, session, payload, mongoSession);
      requiresReview = true;
      reviewReason = 'CHARGEBACK_DISPUTE_WON_AWAITING_REVERSAL';
    } else if (PAYMENT_FAILURE_EVENTS.has(event)) {
      const failureResult = await handlePaymentFailure(db, session, payload, mongoSession);
      requiresReview = failureResult === 'REVIEW_REQUIRED';
      if (requiresReview) reviewReason = `${event}_REQUIRES_REVIEW`;
    } else if (MANUAL_REVIEW_EVENTS.has(event)) {
      await handleManualReviewEvent(db, session, payload, mongoSession);
      requiresReview = true;
      reviewReason = `MANUAL_FINANCIAL_REVIEW:${event}`;
    } else if (event === 'CHECKOUT_PAID') {
      reviewReason = `UNAUTOMATED_FINANCIAL_EVENT:${event}`;
      await markSessionForReview(db, session, reviewReason, mongoSession);
      requiresReview = true;
    }

    await updateLegacyPayment(
      db,
      payload,
      mongoSession,
      allowLegacyConfirmation,
      false,
    );
    return {
      sessionId: session._id,
      edicaoId: session.edicaoId,
      requiresReview,
      reviewReason,
    };
  }
  const assignmentFilter = assignmentCorrelationFilter(payload);
  const assignment = assignmentFilter
    ? await db.collection('pagamentos.atribuicoes').findOne(
        assignmentFilter,
        { projection: { compraId: 1, edicaoId: 1 }, session: mongoSession },
      )
    : null;
  if (assignment) {
    return {
      sessionId: assignment.compraId,
      edicaoId: assignment.edicaoId,
      requiresReview: true,
      orphaned: true,
      reviewReason: 'SESSION_MISSING_FOR_ASSIGNMENT',
    };
  }

  const legacyUpdated = await updateLegacyPayment(db, payload, mongoSession);
  const financiallyRelevant = isFinanciallyRelevantEvent(event, payload.payment);
  return {
    requiresReview: financiallyRelevant && !legacyUpdated,
    orphaned: financiallyRelevant && !legacyUpdated,
    reviewReason:
      financiallyRelevant && !legacyUpdated ? 'PAYMENT_CORRELATION_NOT_FOUND' : null,
  };
}

async function resolveCheckoutPaidPayload(payload) {
  if (String(payload?.event || '') !== 'CHECKOUT_PAID') return payload;

  const checkoutId = String(payload?.checkout?.id || '');
  const apiUrl = process.env.ASAAS_API_URL;
  const apiKey = process.env.ASAAS_API_KEY;
  if (!checkoutId) throw new WebhookReviewError('CHECKOUT_ID_MISSING');
  if (!apiUrl || !apiKey) throw new Error('ASAAS_API_NOT_CONFIGURED');

  const response = await fetch(
    `${apiUrl}/payments?checkoutSession=${encodeURIComponent(checkoutId)}&limit=2`,
    {
      headers: asaasRequestHeaders(apiKey, { apiUrl }),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`ASAAS_CHECKOUT_LOOKUP_FAILED:${response.status}`);

  const body = await response.json();
  const payments = Array.isArray(body?.data)
    ? body.data.filter(
        (payment) =>
          !payment?.deleted && ['CONFIRMED', 'RECEIVED'].includes(String(payment?.status || '')),
      )
    : [];
  if (payments.length !== 1) {
    throw new WebhookReviewError(
      payments.length ? 'CHECKOUT_MULTIPLE_CONFIRMED_PAYMENTS' : 'CHECKOUT_PAYMENT_NOT_CONFIRMED',
    );
  }

  const payment = payments[0];
  return {
    ...payload,
    sourceEvent: 'CHECKOUT_PAID',
    event: payment.status === 'RECEIVED' ? 'PAYMENT_RECEIVED' : 'PAYMENT_CONFIRMED',
    payment,
  };
}

async function processClaimedWebhookEvent(db, client, claimed) {
  try {
    const payload = await resolveCheckoutPaidPayload(claimed.payload);
    const result = await runPaymentTransaction(
      client,
      (mongoSession) => processEvent(db, payload, mongoSession),
    );
    const status = result.requiresReview ? 'REVIEW_REQUIRED' : 'PROCESSED';
    await finishWebhookEvent(db, claimed._id, status, {
      purchaseId: result.sessionId || null,
      edicaoId: result.edicaoId || null,
      orphaned: Boolean(result.orphaned),
      paymentId: payload?.payment?.id || null,
      ...(result.reviewReason ? { reviewReason: result.reviewReason } : {}),
    });
    console.info('Webhook de pagamento processado', {
      eventId: claimed.eventId,
      event: claimed.eventType,
      paymentId: claimed.paymentId,
      status,
    });
    return { processed: true, status };
  } catch (error) {
    if (error instanceof WebhookReviewError) {
      await finishWebhookEvent(db, claimed._id, 'REVIEW_REQUIRED', {
        reviewReason: error.reason,
        paymentId: claimed.paymentId,
      });
      console.warn('Webhook de pagamento requer revisão', {
        eventId: claimed.eventId,
        event: claimed.eventType,
        paymentId: claimed.paymentId,
        reason: error.reason,
      });
      return { processed: true, status: 'REVIEW_REQUIRED' };
    }

    const status = await failWebhookEvent(db, claimed, error);
    console.error('Falha ao processar webhook de pagamento', {
      eventId: claimed.eventId,
      event: claimed.eventType,
      paymentId: claimed.paymentId,
      status,
      error: error instanceof Error ? error.message.slice(0, 200) : 'unknown_error',
    });
    return { processed: false, status };
  }
}

async function runWebhookWorker(limit = 20, timeBudgetMs = 50_000) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 1_000));
  const summary = { processed: 0, reviewRequired: 0, failed: 0 };
  const { db, client } = await connectToDatabase();
  if (!(await ensureWebhookLedgerReady(db))) {
    return { ...summary, reason: 'ledger_not_ready' };
  }
  const workerOwner = new ObjectId().toHexString();
  if (!(await acquireWebhookWorkerLease(db, workerOwner))) {
    return { ...summary, reason: 'worker_busy' };
  }
  const deadline = Date.now() + Math.max(1_000, Math.min(timeBudgetMs, 50_000));
  let releaseLease = true;

  try {
    for (let index = 0; index < boundedLimit; index += 1) {
      if (Date.now() >= deadline) return { ...summary, reason: 'time_budget_exhausted' };
      const claimed = await claimWebhookEvent(db);
      if (!claimed) return { ...summary, reason: 'nothing_due' };
      const result = await processClaimedWebhookEvent(db, client, claimed);
      if (result.status === 'PROCESSED') summary.processed += 1;
      else if (result.status === 'REVIEW_REQUIRED') summary.reviewRequired += 1;
      else {
        summary.failed += 1;
        const failedEvent = await db.collection('pagamentos.webhook_eventos_v2').findOne(
          { _id: claimed._id, status: 'FAILED' },
          { projection: { nextAttemptAt: 1 } },
        );
        if (failedEvent?.nextAttemptAt instanceof Date) {
          await holdWebhookWorkerLeaseUntil(db, workerOwner, failedEvent.nextAttemptAt);
          releaseLease = false;
        }
        break;
      }
    }
    return summary;
  } finally {
    if (releaseLease) await releaseWebhookWorkerLease(db, workerOwner);
  }
}

export async function processAcceptedWebhookEvent(_ledgerId) {
  return runWebhookWorker(1_000, 50_000);
}

export async function drainPendingWebhookEvents(limit = 20, timeBudgetMs = 50_000) {
  return runWebhookWorker(limit, timeBudgetMs);
}

export async function handleAsaasWebhookRequest(
  request,
  schedule = (callback) => after(callback),
  connect = connectToDatabase,
) {
  const expectedToken = derivePaymentCredential('webhook');
  const receivedToken = request.headers.get('asaas-access-token');
  
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
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!getRequiredWebhookEventId(payload) || typeof payload?.event !== 'string') {
    return Response.json({ error: 'invalid_webhook_payload' }, { status: 400 });
  }

  const { db } = await connect();
  if (!(await ensureWebhookLedgerReady(db))) {
    return Response.json({ error: 'webhook_ledger_not_ready' }, { status: 503 });
  }

  let ingestion;
  try {
    ingestion = await ingestWebhookEvent(db, payload);
  } catch (error) {
    console.error('Falha ao persistir webhook de pagamento', {
      eventId: getEventId(payload),
      event: payload.event,
      paymentId: payload?.payment?.id || null,
      error: error instanceof Error ? error.message.slice(0, 200) : 'unknown_error',
    });
    return Response.json({ error: 'webhook_persistence_failed' }, { status: 500 });
  }

  if (ingestion.kind === 'legacy_quarantined') {
    console.warn('Webhook legado colocado em quarentena', {
      eventId: ingestion.eventId,
      event: payload.event,
      paymentId: payload?.payment?.id || null,
    });
    return Response.json({ message: 'legacy_event_quarantined' }, { status: 200 });
  }

  if (ingestion.kind === 'accepted' || ingestion.status === 'PENDING') {
    schedule(() => processAcceptedWebhookEvent(ingestion.ledgerId));
  }

  return Response.json(
    { message: ingestion.kind === 'accepted' ? 'accepted' : 'duplicate_ignored' },
    { status: 200 },
  );
}

export async function POST(request) {
  return handleAsaasWebhookRequest(request);
}
