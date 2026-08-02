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
  let purchase = null;

  try {
    const data = await request.json();
    const userId = await getUserId(request);
    if (!userId || !ObjectId.isValid(userId)) {
      return Response.json({ error: 'not_authenticated', message: 'Sessão inválida.' }, { status: 401 });
    }
    if (
      !data.cardInfo?.name ||
      !data.cardInfo?.number ||
      !data.cardInfo?.expiry ||
      !data.cardInfo?.cvc ||
      !data.personalInfo?.email ||
      !data.personalInfo?.cpfCnpj
    ) {
      return Response.json({ error: 'invalid_card_data', message: 'Preencha os dados do cartão.' }, { status: 400 });
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
      return Response.json({ error: 'active_payment_exists', message: 'Já existe uma cobrança ativa.' }, { status: 409 });
    }
    if (!isPaymentSalesOpen(config)) {
      return Response.json(
        { error: 'payment_sales_closed', message: 'As inscrições não estão abertas.' },
        { status: 409 },
      );
    }
    if (!config.pagamentosAceitos?.includes('CREDIT_CARD')) {
      return Response.json({ error: 'payment_method_not_allowed', message: 'Cartão não está disponível.' }, { status: 422 });
    }

    const configuredInstallment = config.parcelamentos?.find(
      (item) => Number(item.codigo) === Number(data.idPagamento),
    );
    const apiUrl = process.env.ASAAS_API_URL;
    const apiKey = process.env.ASAAS_API_KEY;
    if (!configuredInstallment) {
      return Response.json({ error: 'installment_not_found', message: 'Parcelamento inválido.' }, { status: 422 });
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
    const installment = purchase.paymentConfig.precos.parcelamentos.find(
      (item) => Number(item.codigo) === Number(data.idPagamento),
    );
    if (!installment) throw new Error('Parcelamento inválido.');

    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp =
      forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const [expiryMonth, shortExpiryYear] = String(data.cardInfo.expiry).split('/');
    const expiryYear = shortExpiryYear?.length === 2 ? `20${shortExpiryYear}` : shortExpiryYear;
    const installmentCount = Number(installment.totalParcelas);
    const totalValue = Number((Number(installment.valorCadaParcela) * installmentCount).toFixed(2));
    const originalCents =
      Math.round(Number(configuredInstallment.valorCadaParcela) * 100) *
      Number(configuredInstallment.totalParcelas);
    const finalCents = Math.round(totalValue * 100);
    const payload = {
      customer: user.id_api,
      billingType: 'CREDIT_CARD',
      ...(installmentCount > 1
        ? { installmentCount, totalValue }
        : { value: totalValue }),
      dueDate: new Date().toISOString().split('T')[0],
      externalReference: purchase._id.toHexString(),
      creditCard: {
        holderName: data.cardInfo.name,
        number: data.cardInfo.number,
        expiryMonth,
        expiryYear,
        ccv: data.cardInfo.cvc,
      },
      creditCardHolderInfo: {
        name: data.cardInfo.name,
        email: data.personalInfo.email,
        cpfCnpj: data.personalInfo.cpfCnpj,
        postalCode: data.personalInfo.postalCode,
        addressNumber: data.personalInfo.addressNumber,
        addressComplement: data.personalInfo.addressComplement || '',
        phone: data.personalInfo.phone,
      },
      remoteIp,
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
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          access_token: apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, status: 'CREATING_PAYMENT' },
        { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
      );
      console.error('Resultado desconhecido ao criar cartão manual:', error);
      return Response.json(
        { error: 'payment_reconciliation_required', message: 'A cobrança está sendo verificada.' },
        { status: 503 },
      );
    }

    const responseBody = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok) {
      if (gatewayResponse.status >= 500) {
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
          error: 'credit_card_payment_failed',
          message: responseBody?.errors?.[0]?.description || 'Não foi possível criar a cobrança.',
        },
        { status: gatewayResponse.status >= 500 ? 503 : 422 },
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
            metodoPagamento: 'CREDIT_CARD',
            paymentId: responseBody.id,
            invoiceNumber: responseBody.invoiceNumber,
            paymentUrl: responseBody.invoiceUrl || null,
            selectedInstallmentCode: installment.codigo,
            gatewayState: 'CREATED',
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
        );
        if (sessionUpdate.modifiedCount !== 1) {
          throw new Error('A sessão manual de cartão mudou durante a cobrança.');
        }
        await db.collection('usuarios').updateOne(
        { _id: owner },
        {
          $push: { 'pagamento.lista_pagamentos': historyEntry(responseBody, userId, config.nome) },
          $set: { 'pagamento.situacao': 2 },
        },
        { session: mongoSession },
        );
        await updatePaymentAssignment(
          db,
          purchase._id,
          'PAGAMENTO_PENDENTE',
          {
            metodo: 'CREDIT_CARD',
            paymentId: responseBody.id,
            invoiceNumber: responseBody.invoiceNumber,
          },
          mongoSession,
        );
        await db.collection('pagamentos.atribuicoes').updateOne(
          { compraId: purchase._id },
          {
            $set: {
              valorSelecionadoCentavos: {
                original: originalCents,
                desconto: originalCents - finalCents,
                final: finalCents,
              },
            },
          },
          { session: mongoSession },
        );
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

    return Response.json(
      { success: true, message: 'Cobrança criada. Aguarde a confirmação.' },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PaymentCodeError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('Erro ao criar cartão manual:', error);
    return Response.json(
      { error: 'credit_card_payment_failed', message: 'Não foi possível criar a cobrança.' },
      { status: 500 },
    );
  }
});
