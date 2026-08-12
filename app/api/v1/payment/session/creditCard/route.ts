import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { getUserId } from '@/lib/getUserId';
import {
    cancelPaymentAfterLostDiscountReservation,
    markDiscountHasExternalCharge,
    restoreDiscountAfterRejectedCharge,
    updatePaymentAssignment,
} from '@/lib/payments/codes';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import { isPaymentMethodAllowedForSession } from '@/lib/payments/config';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { asaasRequestHeaders, isAsaasRetryableStatus } from '@/lib/payments/asaas';

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function paymentHistoryEntry(payment: Record<string, unknown>, userId: string, description: string) {
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

function gatewayResponseMatchesAdvancedSession(
    paymentSession: Record<string, any> | null,
    gatewayResponse: Record<string, any>,
    installmentCount: number,
): boolean {
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

export const POST = withApiAuthRequired(async function POST(request: Request) {
    if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
    try {
        const userId = await getUserId(request);
        const data = await request.json();

        if (
            !userId ||
            !ObjectId.isValid(userId) ||
            !data.sessionId ||
            !ObjectId.isValid(data.sessionId)
        ) {
            return NextResponse.json(
                { error: 'invalid_payment_session', message: 'Sessão de pagamento inválida.' },
                { status: 400 },
            );
        }

        if (
            !data.cardInfo?.number ||
            !data.cardInfo?.expiry ||
            !data.cardInfo?.cvc ||
            !data.personalInfo?.name ||
            !data.personalInfo?.email ||
            !data.personalInfo?.cpfCnpj
        ) {
            return NextResponse.json(
                { error: 'invalid_card_data', message: 'Preencha os dados do cartão.' },
                { status: 400 },
            );
        }

        const owner = new ObjectId(userId);
        const sessionId = new ObjectId(data.sessionId);
        const { db, client } = await connectToDatabase();
        const existingSession = await db.collection('pagamentos.sessoes').findOne({
            _id: sessionId,
            owner,
            type: 'ticket',
        });

        if (!existingSession) {
            return NextResponse.json(
                { error: 'payment_session_not_found', message: 'Sessão não encontrada.' },
                { status: 404 },
            );
        }

        if (
            existingSession.status === 'PAYMENT_PENDING' &&
            existingSession.metodoPagamento === 'CREDIT_CARD' &&
            existingSession.paymentId
        ) {
            return NextResponse.json(
                { success: true, message: 'A cobrança já foi criada.' },
                { status: 200 },
            );
        }

        if (!(await isPaymentMethodAllowedForSession(db, existingSession, 'CREDIT_CARD'))) {
            return NextResponse.json(
                {
                    error: 'payment_method_not_allowed',
                    message: 'Cartão de crédito não está disponível.',
                },
                { status: 409 },
            );
        }

        if (existingSession.status !== 'OPEN') {
            return NextResponse.json(
                { error: 'payment_creation_in_progress', message: 'A cobrança já foi iniciada.' },
                { status: 409 },
            );
        }

        if (new Date(existingSession.expiresAt) <= new Date()) {
            return NextResponse.json(
                { error: 'payment_session_expired', message: 'A sessão expirou.' },
                { status: 409 },
            );
        }

        const selectedInstallment = existingSession.paymentConfig?.precos?.parcelamentos?.find(
            (installment) => Number(installment.codigo) === Number(data.idPagamento),
        );
        if (!selectedInstallment) {
            return NextResponse.json(
                { error: 'installment_not_found', message: 'Parcelamento inválido.' },
                { status: 422 },
            );
        }

        const lockedSession = await db.collection('pagamentos.sessoes').findOneAndUpdate(
            {
                _id: sessionId,
                owner,
                status: 'OPEN',
                expiresAt: { $gt: new Date() },
                $or: [
                    { purchaseCancellation: { $exists: false } },
                    { 'purchaseCancellation.status': 'COMPLETED' },
                ],
            },
            {
                $set: {
                    status: 'CREATING_PAYMENT',
                    metodoPagamento: 'CREDIT_CARD',
                    updatedAt: new Date(),
                },
            },
            { returnDocument: 'after' },
        );
        if (!lockedSession) {
            return NextResponse.json(
                { error: 'payment_creation_in_progress', message: 'A cobrança já está sendo criada.' },
                { status: 409 },
            );
        }

        const user = await db.collection('usuarios').findOne(
            { _id: owner },
            { projection: { id_api: 1 } },
        );
        const apiUrl = process.env.ASAAS_API_URL;
        const apiKey = process.env.ASAAS_API_KEY;
        if (!user?.id_api || !apiUrl || !apiKey) {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                { $set: { status: 'OPEN', metodoPagamento: null, updatedAt: new Date() } },
            );
            return NextResponse.json(
                { error: 'payment_gateway_not_configured', message: 'Pagamento indisponível.' },
                { status: 503 },
            );
        }

        const forwardedFor = request.headers.get('x-forwarded-for');
        const remoteIp =
            forwardedFor?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            '127.0.0.1';
        const [expiryMonth, shortExpiryYear] = String(data.cardInfo.expiry).split('/');
        const expiryYear =
            shortExpiryYear?.length === 2 ? `20${shortExpiryYear}` : shortExpiryYear;
        const installmentCount = Number(selectedInstallment.totalParcelas);
        const totalValue = Number(
            (Number(selectedInstallment.valorCadaParcela) * installmentCount).toFixed(2),
        );
        const originalInstallment = existingSession.paymentConfigOriginal?.precos?.parcelamentos?.find(
            (installment) => Number(installment.codigo) === Number(data.idPagamento),
        );
        const finalCents = Math.round(totalValue * 100);
        const installmentValueCentavos = Math.round(
            Number(selectedInstallment.valorCadaParcela) * 100,
        );
        const originalCents = originalInstallment
            ? Math.round(Number(originalInstallment.valorCadaParcela) * 100) *
              Number(originalInstallment.totalParcelas)
            : finalCents;
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
                { _id: sessionId, owner, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        selectedInstallmentCode: selectedInstallment.codigo,
                        valorSelecionadoCentavos: selectedValueSnapshot,
                        ...(provisionalInstallmentPlan
                            ? { installmentPlan: provisionalInstallmentPlan }
                            : {}),
                        updatedAt: new Date(),
                    },
                    ...(provisionalInstallmentPlan
                        ? {}
                        : { $unset: { installmentPlan: '' } }),
                },
                { session: mongoSession },
            );
            const assignmentPreparation = await db.collection('pagamentos.atribuicoes').updateOne(
                { compraId: sessionId, usuarioId: owner },
                {
                    $set: {
                        valorSelecionadoCentavos: selectedValueSnapshot,
                        ...(provisionalInstallmentPlan
                            ? { installmentPlan: provisionalInstallmentPlan }
                            : {}),
                        updatedAt: new Date(),
                    },
                    ...(provisionalInstallmentPlan
                        ? {}
                        : { $unset: { installmentPlan: '' } }),
                },
                { session: mongoSession },
            );
            if (sessionPreparation.matchedCount !== 1 || assignmentPreparation.matchedCount !== 1) {
                throw new Error('PAYMENT_INSTALLMENT_PREPARATION_FAILED');
            }
        });
        const requestBody: Record<string, unknown> = {
            customer: user.id_api,
            billingType: 'CREDIT_CARD',
            dueDate: formatDate(new Date()),
            externalReference: sessionId.toHexString(),
            creditCard: {
                holderName: data.personalInfo.name,
                number: data.cardInfo.number,
                expiryMonth,
                expiryYear,
                ccv: data.cardInfo.cvc,
            },
            creditCardHolderInfo: {
                name: data.personalInfo.name,
                email: data.personalInfo.email,
                cpfCnpj: data.personalInfo.cpfCnpj,
                postalCode: data.personalInfo.postalCode,
                addressNumber: data.personalInfo.addressNumber,
                addressComplement: data.personalInfo.addressComplement || '',
                phone: data.personalInfo.phone,
            },
            remoteIp,
        };

        if (installmentCount > 1) {
            requestBody.installmentCount = installmentCount;
            requestBody.totalValue = totalValue;
        } else {
            requestBody.value = totalValue;
        }

        const discountLockedForCharge = await markDiscountHasExternalCharge(db, sessionId);
        if (lockedSession.codigoDesconto && !discountLockedForCharge) {
            await runPaymentTransaction(client, async (mongoSession) => {
                await cancelPaymentAfterLostDiscountReservation(
                    db,
                    sessionId,
                    mongoSession,
                );
            });
            return NextResponse.json(
                {
                    error: 'discount_reservation_lost',
                    message: 'A reserva do desconto expirou. Inicie uma nova compra.',
                },
                { status: 409 },
            );
        }
        let gatewayResponse: Response;
        try {
            gatewayResponse = await fetch(`${apiUrl}/payments`, {
                method: 'POST',
                headers: asaasRequestHeaders(apiKey, { json: true, apiUrl }),
                signal: AbortSignal.timeout(10_000),
                body: JSON.stringify(requestBody),
            });
        } catch (error) {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
            );
            console.error('Resultado desconhecido ao criar cobrança de cartão:', error);
            return NextResponse.json(
                {
                    error: 'payment_reconciliation_required',
                    message: 'A cobrança está sendo verificada. Não tente novamente.',
                },
                { status: 503 },
            );
        }

        const responseBody = await gatewayResponse.json().catch(() => ({}));
        if (!gatewayResponse.ok) {
            if (isAsaasRetryableStatus(gatewayResponse.status)) {
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: sessionId, status: 'CREATING_PAYMENT' },
                    { $set: { gatewayState: 'RECONCILIATION_REQUIRED', updatedAt: new Date() } },
                );
            } else {
                await restoreDiscountAfterRejectedCharge(
                    db,
                    sessionId,
                    new Date(existingSession.expiresAt),
                );
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: sessionId, status: 'CREATING_PAYMENT' },
                    { $set: { status: 'OPEN', metodoPagamento: null, updatedAt: new Date() } },
                );
            }

            return NextResponse.json(
                {
                    error: 'credit_card_payment_failed',
                    message:
                        responseBody?.errors?.[0]?.description ||
                        'Não foi possível criar a cobrança.',
                },
                    { status: isAsaasRetryableStatus(gatewayResponse.status) ? 503 : 422 },
            );
        }

        if (!responseBody?.id || (installmentCount > 1 && !responseBody?.installment)) {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        gatewayState: 'RECONCILIATION_REQUIRED',
                        updatedAt: new Date(),
                    },
                },
            );
            return NextResponse.json(
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
                    invoiceNumber: responseBody.invoiceNumber
                        ? String(responseBody.invoiceNumber)
                        : null,
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
                        { _id: sessionId },
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
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        status: 'PAYMENT_PENDING',
                        gatewayState: 'CREATED',
                        paymentId: responseBody.id,
                        invoiceNumber: responseBody.invoiceNumber,
                        paymentUrl: responseBody.invoiceUrl || null,
                        selectedInstallmentCode: selectedInstallment.codigo,
                        ...(installmentPlanForCommit
                            ? { installmentPlan: installmentPlanForCommit }
                            : {}),
                        updatedAt: new Date(),
                    },
                },
                { session: mongoSession },
                );
                if (sessionUpdate.modifiedCount !== 1) {
                    throw new Error('A sessão de cartão mudou durante a criação da cobrança.');
                }

                const userUpdate = await db.collection('usuarios').updateOne(
                { _id: owner },
                {
                    $push: {
                        'pagamento.lista_pagamentos': paymentHistoryEntry(
                            responseBody,
                            userId,
                            lockedSession.paymentConfig.nome,
                        ),
                    },
                    $set: { 'pagamento.situacao': 2 },
                },
                { session: mongoSession },
                );
                if (userUpdate.matchedCount !== 1) {
                    throw new Error('PAYMENT_SESSION_OWNER_UPDATE_FAILED');
                }
                const assignmentUpdated = await updatePaymentAssignment(
                    db,
                    sessionId,
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
                    { compraId: sessionId },
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
                { _id: sessionId, owner },
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
                    { _id: sessionId, owner },
                    {
                        $set: {
                            paymentUrl: responseBody.invoiceUrl || advancedSession?.paymentUrl || null,
                            selectedInstallmentCode: selectedInstallment.codigo,
                            updatedAt: new Date(),
                        },
                    },
                );
                return NextResponse.json(
                    {
                        success: true,
                        message: 'A cobrança foi criada e o pagamento já está sendo processado.',
                    },
                    { status: 200 },
                );
            }
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
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

        return NextResponse.json(
            {
                success: true,
                message: 'Cobrança criada. Aguarde a confirmação do pagamento.',
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('Erro ao criar cobrança de cartão:', error);
        return NextResponse.json(
            { error: 'credit_card_payment_failed', message: 'Não foi possível criar a cobrança.' },
            { status: 500 },
        );
    }
});
