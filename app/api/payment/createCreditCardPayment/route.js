import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
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
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { asaasRequestHeaders, isAsaasRetryableStatus } from '@/lib/payments/asaas';
import {
  normalizeCardHolderInput,
  preparePaymentCustomer,
} from '@/lib/payments/customer-sync';
import { getPaymentRemoteIp } from '@/lib/payments/remote-ip';

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

function gatewayResponseMatchesAdvancedSession(paymentSession, gatewayResponse, installmentCount) {
  if (
    !paymentSession ||
    !['PAYMENT_PENDING', 'CONFIRMED', 'PAYMENT_REVIEW_REQUIRED', 'REFUNDED'].includes(
      String(paymentSession.status),
    ) ||
    paymentSession.metodoPagamento !== 'CREDIT_CARD'
  ) {
    return false;
  }
  if (installmentCount > 1) {
    return Boolean(
      gatewayResponse.installment &&
      paymentSession.installmentPlan?.installmentId &&
      String(gatewayResponse.installment) ===
        String(paymentSession.installmentPlan.installmentId),
    );
  }
  return Boolean(
    gatewayResponse.id &&
    paymentSession.paymentId &&
    String(gatewayResponse.id) === String(paymentSession.paymentId),
  );
}

export const POST = withApiAuthRequired(async function POST(request) {
  if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
  let purchase = null;

  try {
    const data = await request.json();
    const authSession = await getSession(request);
    const userId = String(authSession?.user?.sub || '').replace(/^auth0\|/, '');
    if (!userId || !ObjectId.isValid(userId)) {
      return Response.json({ error: 'not_authenticated', message: 'Sessão inválida.' }, { status: 401 });
    }
    const cardHolder = normalizeCardHolderInput(data.personalInfo);
    if (
      !data.cardInfo?.name ||
      !data.cardInfo?.number ||
      !data.cardInfo?.expiry ||
      !data.cardInfo?.cvc ||
      !cardHolder.ok
    ) {
      return Response.json(
        {
          error: 'invalid_card_data',
          message: cardHolder.ok ? 'Preencha os dados do cartão.' : cardHolder.message,
        },
        { status: 400 },
      );
    }

    const owner = new ObjectId(userId);
    const { db, client } = await connectToDatabase();
    const [user, config] = await Promise.all([
      db.collection('usuarios').findOne({ _id: owner }, { projection: { id_api: 1 } }),
      getActivePaymentConfig(db),
    ]);
    if (!config) {
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

    const remoteIp = getPaymentRemoteIp(request);
    if (!remoteIp) {
      return Response.json(
        { error: 'payment_remote_ip_missing', message: 'Não foi possível identificar a origem segura do pagamento.' },
        { status: 400 },
      );
    }
    const preparedCustomer = await preparePaymentCustomer({
      db,
      owner,
      userId,
      existingCustomerId: user?.id_api,
      payer: data.payer ?? data.personalInfo,
      email: authSession?.user?.email,
      apiUrl,
      apiKey,
    });
    if (!preparedCustomer.ok) {
      return Response.json(
        { error: preparedCustomer.code.toLowerCase(), message: preparedCustomer.message },
        { status: preparedCustomer.status },
      );
    }

    purchase = await prepareManualTicketPurchase(db, {
      owner,
      config,
      codigoDesconto: data.codigoDesconto,
      codigoRastreio: data.codigoRastreio,
      userProps: {
        name: preparedCustomer.payer.name,
        cpf: preparedCustomer.payer.cpfCnpj,
        zipCode: preparedCustomer.payer.postalCode,
        number: preparedCustomer.payer.addressNumber,
        complement: preparedCustomer.payer.complement || '',
        email: String(authSession?.user?.email || ''),
        phone: '',
        street: '',
        neighborhood: '',
      },
    });
    const installment = purchase.paymentConfig.precos.parcelamentos.find(
      (item) => Number(item.codigo) === Number(data.idPagamento),
    );
    if (!installment) throw new Error('Parcelamento inválido.');

    const [expiryMonth, shortExpiryYear] = String(data.cardInfo.expiry).split('/');
    const expiryYear = shortExpiryYear?.length === 2 ? `20${shortExpiryYear}` : shortExpiryYear;
    const installmentCount = Number(installment.totalParcelas);
    const totalValue = Number((Number(installment.valorCadaParcela) * installmentCount).toFixed(2));
    const originalCents =
      Math.round(Number(configuredInstallment.valorCadaParcela) * 100) *
      Number(configuredInstallment.totalParcelas);
    const finalCents = Math.round(totalValue * 100);
    const installmentValueCentavos = Math.round(Number(installment.valorCadaParcela) * 100);
    const selectedValueSnapshot = {
      original: originalCents,
      desconto: originalCents - finalCents,
      final: finalCents,
    };
    const provisionalInstallmentPlan = installmentCount > 1
      ? {
          installmentId: null,
          count: installmentCount,
          totalValueCentavos: finalCents,
          installmentValueCentavos,
          observedPayments: [],
        }
      : null;

    await runPaymentTransaction(client, async (mongoSession) => {
      const sessionPreparation = await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, owner, status: 'CREATING_PAYMENT' },
        {
          $set: {
            metodoPagamento: 'CREDIT_CARD',
            selectedInstallmentCode: installment.codigo,
            valorSelecionadoCentavos: selectedValueSnapshot,
            ...(provisionalInstallmentPlan
              ? { installmentPlan: provisionalInstallmentPlan }
              : {}),
            updatedAt: new Date(),
          },
          ...(provisionalInstallmentPlan ? {} : { $unset: { installmentPlan: '' } }),
        },
        { session: mongoSession },
      );
      const assignmentPreparation = await db.collection('pagamentos.atribuicoes').updateOne(
        { compraId: purchase._id, usuarioId: owner },
        {
          $set: {
            valorSelecionadoCentavos: selectedValueSnapshot,
            ...(provisionalInstallmentPlan
              ? { installmentPlan: provisionalInstallmentPlan }
              : {}),
            updatedAt: new Date(),
          },
          ...(provisionalInstallmentPlan ? {} : { $unset: { installmentPlan: '' } }),
        },
        { session: mongoSession },
      );
      if (sessionPreparation.matchedCount !== 1 || assignmentPreparation.matchedCount !== 1) {
        throw new Error('PAYMENT_INSTALLMENT_PREPARATION_FAILED');
      }
    });
    const payload = {
      customer: preparedCustomer.customerId,
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
        name: cardHolder.value.name,
        email: cardHolder.value.email,
        cpfCnpj: cardHolder.value.cpfCnpj,
        postalCode: cardHolder.value.postalCode,
        addressNumber: cardHolder.value.addressNumber,
        addressComplement: cardHolder.value.complement || '',
        phone: cardHolder.value.phone,
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
        headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
        signal: AbortSignal.timeout(10_000),
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
          error: 'credit_card_payment_failed',
          message: responseBody?.errors?.[0]?.description || 'Não foi possível criar a cobrança.',
        },
          { status: isAsaasRetryableStatus(gatewayResponse.status) ? 503 : 422 },
      );
    }

    if (!responseBody?.id || (installmentCount > 1 && !responseBody?.installment)) {
      await db.collection('pagamentos.sessoes').updateOne(
        { _id: purchase._id, status: 'CREATING_PAYMENT' },
        { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
      );
      return Response.json(
        { error: 'invalid_gateway_response', message: 'A cobrança precisa de conciliação.' },
        { status: 503 },
      );
    }

    const installmentPlan = installmentCount > 1
      ? {
          installmentId: String(responseBody.installment),
          count: installmentCount,
          totalValueCentavos: finalCents,
          installmentValueCentavos,
          observedPayments: [{
            paymentId: String(responseBody.id),
            invoiceNumber: responseBody.invoiceNumber ? String(responseBody.invoiceNumber) : null,
            installmentNumber: Number(responseBody.installmentNumber || 1),
            status: String(responseBody.status || 'PENDING'),
            value: installmentValueCentavos / 100,
            valueCentavos: installmentValueCentavos,
            lastEvent: 'PAYMENT_CREATED',
            lastEventId: null,
            observedAt: new Date(),
          }],
        }
      : null;

    try {
      await runPaymentTransaction(client, async (mongoSession) => {
        const currentInstallmentPlan = installmentPlan
          ? await db.collection('pagamentos.sessoes').findOne(
              { _id: purchase._id },
              { projection: { installmentPlan: 1 }, session: mongoSession },
            )
          : null;
        const installmentPlanForCommit = installmentPlan
          ? {
              ...installmentPlan,
              observedPayments: [
                ...(Array.isArray(currentInstallmentPlan?.installmentPlan?.observedPayments)
                  ? currentInstallmentPlan.installmentPlan.observedPayments.filter(
                      (item) => String(item?.paymentId || '') !== String(responseBody.id),
                    )
                  : []),
                ...installmentPlan.observedPayments,
              ],
            }
          : null;
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
            ...(installmentPlanForCommit
              ? { installmentPlan: installmentPlanForCommit }
              : {}),
            gatewayState: 'CREATED',
            updatedAt: new Date(),
          },
        },
        { session: mongoSession },
        );
        if (sessionUpdate.modifiedCount !== 1) {
          throw new Error('A sessão manual de cartão mudou durante a cobrança.');
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
            metodo: 'CREDIT_CARD',
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
              valorSelecionadoCentavos: selectedValueSnapshot,
              ...(installmentPlanForCommit
                ? { installmentPlan: installmentPlanForCommit }
                : {}),
            },
          },
          { session: mongoSession },
        );
        if (assignmentValuesUpdate.matchedCount !== 1) {
          throw new Error('PAYMENT_ASSIGNMENT_VALUES_UPDATE_FAILED');
        }
      });
    } catch (transactionError) {
      const advancedSession = await db.collection('pagamentos.sessoes').findOne(
        { _id: purchase._id, owner },
        {
          projection: {
            status: 1,
            metodoPagamento: 1,
            paymentId: 1,
            paymentUrl: 1,
            installmentPlan: 1,
          },
        },
      );
      if (gatewayResponseMatchesAdvancedSession(
        advancedSession,
        responseBody,
        installmentCount,
      )) {
        await db.collection('pagamentos.sessoes').updateOne(
          { _id: purchase._id, owner },
          {
            $set: {
              paymentUrl: responseBody.invoiceUrl || advancedSession?.paymentUrl || null,
              selectedInstallmentCode: installment.codigo,
              updatedAt: new Date(),
            },
          },
        );
        return Response.json(
          {
            success: true,
            message: 'A cobrança foi criada e o pagamento já está sendo processado.',
          },
          { status: 200 },
        );
      }
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
