import { ObjectId } from 'mongodb';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import { getActivePaymentConfig, getEditionId, isPaymentSalesOpen } from '@/lib/payments/config';
import { prepareManualTicketPurchase } from '@/lib/payments/manual-purchase';
import {
  cancelPaymentAfterLostDiscountReservation,
  hasConfirmedRegistrationForEdition,
  markDiscountHasExternalCharge,
  PaymentCodeError,
  releaseDiscountReservation,
  restoreDiscountAfterRejectedCharge,
  updatePaymentAssignment,
} from '@/lib/payments/codes';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import { getPaymentOverdueGraceDays } from '@/lib/payments/overdue';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { asaasRequestHeaders, isAsaasRetryableStatus } from '@/lib/payments/asaas';

const METHODS = ['PIX', 'BOLETO', 'DEBIT_CARD', 'CREDIT_CARD'];

function valueForMethod(session, method) {
  const prices = session.paymentConfig.precos;
  if (method === 'PIX') return prices.valorPix;
  if (method === 'BOLETO') return prices.valorBoleto;
  if (method === 'DEBIT_CARD') return prices.valorDebito;
  if (method === 'CREDIT_CARD') return prices.valorAVista;
  return null;
}

function historyEntry(payment, userId, description) {
  return {
    _id: new ObjectId(),
    object: payment.object,
    id: payment.id,
    dateCreated: payment.dateCreated,
    customer: payment.customer,
    value: payment.value,
    netValue: payment.netValue,
    description,
    billingType: payment.billingType,
    status: payment.status,
    dueDate: payment.dueDate,
    invoiceUrl: payment.invoiceUrl,
    invoiceNumber: payment.invoiceNumber,
    externalReference: payment.externalReference,
    _type: 'ticket',
    _userId: userId,
  };
}

export const POST = withApiAuthRequired(async function POST(request) {
  if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
  let purchase = null;

  try {
    const data = await request.json();
    const userId = await getUserId(request);
    if (!userId || !ObjectId.isValid(userId)) {
      return Response.json({ error: 'not_authenticated', message: 'Sessão inválida.' }, { status: 401 });
    }
    if (!METHODS.includes(data.typePayment)) {
      return Response.json({ error: 'invalid_payment_method', message: 'Método inválido.' }, { status: 422 });
    }

    const owner = new ObjectId(userId);
    const { db, client } = await connectToDatabase();
    const [user, config] = await Promise.all([
      db.collection('usuarios').findOne({ _id: owner }, { projection: { id_api: 1 } }),
      getActivePaymentConfig(db),
    ]);
    if (!user?.id_api || !config) {
      return Response.json({ error: 'payment_config_not_found', message: 'Pagamento indisponível.' }, { status: 404 });
    }
    if (config.modo !== 'manual') {
      return Response.json(
        {
          error: 'manual_payment_disabled',
          message: 'O fluxo manual de pagamento não está ativo.',
        },
        { status: 409 },
      );
    }
    const edicaoId = getEditionId(config);
    if (await hasConfirmedRegistrationForEdition(db, owner, edicaoId)) {
      return Response.json(
        {
          error: 'registration_already_confirmed',
          message: 'Sua inscrição nesta edição já está confirmada.',
        },
        { status: 409 },
      );
    }
    const activePurchase = await db.collection('pagamentos.sessoes').findOne({
      owner,
      edicaoId,
      type: 'ticket',
      status: {
        $in: ['OPEN', 'CREATING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'],
      },
    });
    if (activePurchase) {
      return Response.json(
        { error: 'active_payment_exists', message: 'Já existe uma cobrança ativa.' },
        { status: 409 },
      );
    }
    if (!isPaymentSalesOpen(config)) {
      return Response.json(
        { error: 'payment_sales_closed', message: 'As inscrições não estão abertas.' },
        { status: 409 },
      );
    }
    if (!config.pagamentosAceitos?.includes(data.typePayment)) {
      return Response.json(
        { error: 'payment_method_not_allowed', message: 'Esse método de pagamento não é aceito.' },
        { status: 422 },
      );
    }

    const configuredValue =
      data.typePayment === 'PIX'
        ? config.valorPix
        : data.typePayment === 'BOLETO'
          ? config.valorBoleto
          : data.typePayment === 'DEBIT_CARD'
            ? config.valorDebito
            : config.valorAVista;
    const apiUrl = process.env.ASAAS_API_URL;
    const apiKey = process.env.ASAAS_API_KEY;
    if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
      return Response.json({ error: 'invalid_payment_value', message: 'Valor inválido.' }, { status: 422 });
    }
    if (!apiUrl || !apiKey) {
      return Response.json(
        { error: 'payment_gateway_not_configured', message: 'Gateway não configurado.' },
        { status: 503 },
      );
    }

    purchase = await prepareManualTicketPurchase(db, {
      owner,
      config,
      codigoDesconto: data.codigoDesconto,
      codigoRastreio: data.codigoRastreio,
    });
    const value = valueForMethod(purchase, data.typePayment);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Valor do pagamento inválido.');
    }

    const payload = {
      customer: user.id_api,
      name: config.nome,
      billingType: data.typePayment === 'DEBIT_CARD' ? 'UNDEFINED' : data.typePayment,
      value,
      dueDate: new Date().toISOString().split('T')[0],
      description: config.nome,
      daysAfterDueDateToRegistrationCancellation: getPaymentOverdueGraceDays(),
      externalReference: purchase._id.toHexString(),
      callback: { successUrl: process.env.ASAAS_URL_CALLBACK, autoRedirect: false },
      postalService: false,
    };

    const discountLockedForCharge = await markDiscountHasExternalCharge(db, purchase._id);
    if (purchase.codigoDesconto && !discountLockedForCharge) {
      await runPaymentTransaction(client, (mongoSession) =>
        cancelPaymentAfterLostDiscountReservation(db, purchase._id, mongoSession),
      );
      return Response.json(
        {
          error: 'discount_reservation_lost',
          message: 'A reserva do desconto expirou. Inicie uma nova compra.',
        },
        { status: 409 },
      );
    }
    let gatewayResponse;
    try {
      gatewayResponse = await fetch(`${apiUrl}/payments`, {
        method: 'POST',
        headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, status: 'CREATING_PAYMENT' },
        { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
      );
      console.error('Resultado desconhecido ao criar cobrança manual:', error);
      return Response.json(
        { error: 'payment_reconciliation_required', message: 'A cobrança está sendo verificada.' },
        { status: 503 },
      );
    }

    const responseBody = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok) {
      if (isAsaasRetryableStatus(gatewayResponse.status)) {
        await db.collection('pagamentos.sessoes').updateOne(
          { _id: purchase._id },
          { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
        );
      } else {
        await restoreDiscountAfterRejectedCharge(db, purchase._id, new Date(purchase.expiresAt));
        await Promise.all([
          db.collection('pagamentos.sessoes').updateOne(
            { _id: purchase._id },
            {
              $set: { status: 'CANCELLED', updatedAt: new Date() },
              $unset: { activeKey: '' },
            },
          ),
          releaseDiscountReservation(db, purchase._id),
          updatePaymentAssignment(db, purchase._id, 'CANCELADA'),
        ]);
      }
      return Response.json(
        {
          error: 'payment_creation_failed',
          message: responseBody?.errors?.[0]?.description || 'Não foi possível criar a cobrança.',
        },
        { status: isAsaasRetryableStatus(gatewayResponse.status) ? 503 : 422 },
      );
    }

    if (!responseBody?.id) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, status: 'CREATING_PAYMENT' },
        { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
      );
      return Response.json(
        { error: 'invalid_gateway_response', message: 'A cobrança precisa de conciliação.' },
        { status: 503 },
      );
    }

    try {
      await runPaymentTransaction(client, async (mongoSession) => {
        const sessionUpdate = await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, status: 'CREATING_PAYMENT' },
        {
          $set: {
            status: 'PAYMENT_PENDING',
            metodoPagamento: data.typePayment,
            paymentId: responseBody.id,
            invoiceNumber: responseBody.invoiceNumber,
            paymentUrl: responseBody.invoiceUrl || null,
            gatewayState: 'CREATED',
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
        );
        if (sessionUpdate.modifiedCount !== 1) {
          throw new Error('A sessão manual mudou durante a criação da cobrança.');
        }
        const userUpdate = await db.collection('usuarios').updateOne(
        { _id: owner },
        {
          $push: { 'pagamento.lista_pagamentos': historyEntry(responseBody, userId, config.nome) },
          $set: { 'pagamento.situacao': 2 },
        },
        { session: mongoSession },
        );
        if (userUpdate.matchedCount !== 1) throw new Error('PAYMENT_SESSION_OWNER_UPDATE_FAILED');
        const assignmentUpdated = await updatePaymentAssignment(
          db,
          purchase._id,
          'PAGAMENTO_PENDENTE',
          {
            metodo: data.typePayment,
            paymentId: responseBody.id,
            invoiceNumber: responseBody.invoiceNumber,
          },
          mongoSession,
        );
        if (!assignmentUpdated) throw new Error('PAYMENT_ASSIGNMENT_UPDATE_FAILED');
        const assignmentValuesUpdate = await db.collection('pagamentos.atribuicoes').updateOne(
          { compraId: purchase._id },
          {
            $set: {
              valorSelecionadoCentavos: {
                original: purchase.valoresCentavos.original[data.typePayment],
                desconto: purchase.valoresCentavos.desconto[data.typePayment],
                final: purchase.valoresCentavos.final[data.typePayment],
              },
            },
          },
          { session: mongoSession },
        );
        if (assignmentValuesUpdate.matchedCount !== 1) {
          throw new Error('PAYMENT_ASSIGNMENT_VALUES_UPDATE_FAILED');
        }
      });
    } catch (transactionError) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, status: 'CREATING_PAYMENT' },
        {
          $set: {
            gatewayState: 'RECONCILIATION_REQUIRED',
            paymentId: responseBody.id,
            invoiceNumber: responseBody.invoiceNumber,
            paymentUrl: responseBody.invoiceUrl || null,
            updatedAt: new Date(),
          },
        },
      );
      throw transactionError;
    }

    return Response.json({ link: responseBody.invoiceUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentCodeError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('Erro ao criar pagamento manual:', error);
    return Response.json(
      { error: 'payment_creation_failed', message: 'Não foi possível criar a cobrança.' },
      { status: 500 },
    );
  }
});
