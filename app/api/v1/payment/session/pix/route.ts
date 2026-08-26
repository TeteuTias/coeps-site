import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import {
    cancelPaymentAfterLostDiscountReservation,
    markDiscountHasExternalCharge,
    restoreDiscountAfterRejectedCharge,
    updatePaymentAssignment,
} from '@/lib/payments/codes';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import { isPaymentMethodAllowedForSession } from '@/lib/payments/config';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { isAsaasRetryableStatus } from '@/lib/payments/asaas';
import {
    createAsaasCheckoutWithCustomerCityRepair,
    isAsaasMissingCustomerCityError,
} from '@/lib/payments/customer-provisioning';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
    try {
        const userId = await getUserId(request);
        const body = await request.json();

        if (
            !userId ||
            !ObjectId.isValid(userId) ||
            !body.sessionId ||
            !ObjectId.isValid(body.sessionId)
        ) {
            return NextResponse.json(
                { error: 'invalid_payment_session', message: 'Sessão de pagamento inválida.' },
                { status: 400 },
            );
        }

        const { db, client } = await connectToDatabase();
        const owner = new ObjectId(userId);
        const sessionId = new ObjectId(body.sessionId);
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
            existingSession.metodoPagamento === 'PIX' &&
            existingSession.paymentUrl
        ) {
            return NextResponse.json(
                {
                    success: true,
                    paymentUrl: existingSession.paymentUrl,
                    checkoutId: existingSession.orderId,
                    checkoutExpiresAt: existingSession.checkoutExpiresAt ?? null,
                },
                { status: 200 },
            );
        }

        if (!(await isPaymentMethodAllowedForSession(db, existingSession, 'PIX'))) {
            return NextResponse.json(
                { error: 'payment_method_not_allowed', message: 'PIX não está disponível.' },
                { status: 409 },
            );
        }

        if (existingSession.status !== 'OPEN') {
            return NextResponse.json(
                {
                    error: 'payment_creation_in_progress',
                    message: 'A cobrança desta sessão já foi iniciada.',
                },
                { status: 409 },
            );
        }

        if (new Date(existingSession.expiresAt) <= new Date()) {
            return NextResponse.json(
                { error: 'payment_session_expired', message: 'A sessão expirou.' },
                { status: 409 },
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
                    metodoPagamento: 'PIX',
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
        if (!user?.id_api) {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                { $set: { status: 'OPEN', metodoPagamento: null, updatedAt: new Date() } },
            );
            return NextResponse.json(
                { error: 'payment_customer_not_found', message: 'Cadastro de pagamento não encontrado.' },
                { status: 404 },
            );
        }

        const apiUrl = process.env.ASAAS_API_URL;
        const apiKey = process.env.ASAAS_API_KEY;
        if (!apiUrl || !apiKey) {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                { $set: { status: 'OPEN', metodoPagamento: null, updatedAt: new Date() } },
            );
            return NextResponse.json(
                { error: 'payment_gateway_not_configured', message: 'Gateway não configurado.' },
                { status: 503 },
            );
        }

        const checkoutRequest = {
            billingTypes: ['PIX'],
            minutesToExpire: 15,
            customer: user.id_api,
            chargeTypes: ['DETACHED'],
            externalReference: sessionId.toHexString(),
            callback: {
                successUrl: process.env.ASAAS_URL_CALLBACK,
                cancelUrl: process.env.ASAAS_URL_REDIRECT,
                expiredUrl: process.env.ASAAS_URL_CALLBACK,
            },
            items: [
                {
                    description: lockedSession.paymentConfig.nome,
                    name: lockedSession.paymentConfig.nome,
                    quantity: 1,
                    value: lockedSession.paymentConfig.precos.valorPix,
                },
            ],
        };

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
        const checkoutResult = await createAsaasCheckoutWithCustomerCityRepair({
            customerId: String(user.id_api),
            address: {
                postalCode: lockedSession.userProps?.zipCode,
                address: lockedSession.userProps?.street,
                addressNumber: lockedSession.userProps?.number,
                province: lockedSession.userProps?.neighborhood,
                complement: lockedSession.userProps?.complement,
            },
            apiUrl,
            apiKey,
            checkout: checkoutRequest,
        });

        if (checkoutResult.kind === 'checkout_unknown') {
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        gatewayState: 'RECONCILIATION_REQUIRED',
                        updatedAt: new Date(),
                    },
                },
            );
            console.error(
                'Resultado desconhecido ao criar checkout PIX.',
                { customerCityRepairAttempted: checkoutResult.repairAttempted },
            );
            return NextResponse.json(
                {
                    error: 'payment_reconciliation_required',
                    message: 'A criação da cobrança está sendo verificada. Não tente outra cobrança.',
                },
                { status: 503 },
            );
        }

        if (checkoutResult.kind === 'repair_failed') {
            await restoreDiscountAfterRejectedCharge(
                db,
                sessionId,
                new Date(existingSession.expiresAt),
            );
            await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                { $set: { status: 'OPEN', metodoPagamento: null, updatedAt: new Date() } },
            );
            return NextResponse.json(
                {
                    error: checkoutResult.repair.code.toLowerCase(),
                    message: checkoutResult.repair.code === 'CUSTOMER_ADDRESS_INVALID'
                        ? 'Não foi possível identificar a cidade pelo CEP informado. Revise o endereço.'
                        : checkoutResult.repair.status === 503
                          ? 'Não foi possível confirmar o endereço no gateway. Tente novamente.'
                          : 'O gateway recusou a atualização do endereço. Revise seus dados.',
                },
                { status: checkoutResult.repair.status },
            );
        }

        const { response: gatewayResponse, body: gatewayBody } = checkoutResult;
        if (!gatewayResponse.ok) {
            const missingCustomerCity = isAsaasMissingCustomerCityError(gatewayBody);
            if (isAsaasRetryableStatus(gatewayResponse.status)) {
                await db.collection('pagamentos.sessoes').updateOne(
                    { _id: sessionId, status: 'CREATING_PAYMENT' },
                    {
                        $set: {
                            gatewayState: 'RECONCILIATION_REQUIRED',
                            updatedAt: new Date(),
                        },
                    },
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
                    error: missingCustomerCity
                        ? 'payment_customer_address_invalid'
                        : 'pix_checkout_failed',
                    message: missingCustomerCity
                        ? 'Não foi possível identificar a cidade pelo CEP informado. Revise o endereço.'
                        : gatewayBody?.errors?.[0]?.description ||
                          'Não foi possível criar o checkout PIX.',
                },
                { status: isAsaasRetryableStatus(gatewayResponse.status) ? 503 : 422 },
            );
        }

        if (!gatewayBody?.id || !gatewayBody?.link) {
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
                {
                    error: 'invalid_gateway_response',
                    message: 'A cobrança foi criada, mas precisa de conciliação.',
                },
                { status: 503 },
            );
        }

        const checkoutExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

        try {
            await runPaymentTransaction(client, async (mongoSession) => {
                const sessionUpdate = await db.collection('pagamentos.sessoes').updateOne(
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        status: 'PAYMENT_PENDING',
                        gatewayState: 'CREATED',
                        orderId: gatewayBody.id,
                        paymentUrl: gatewayBody.link,
                        checkoutExpiresAt,
                        updatedAt: new Date(),
                    },
                },
                { session: mongoSession },
                );
                if (sessionUpdate.modifiedCount !== 1) {
                    throw new Error('A sessão PIX mudou durante a criação da cobrança.');
                }

                const userUpdate = await db.collection('usuarios').updateOne(
                { _id: owner, 'pagamento.situacao': { $ne: 1 } },
                { $set: { 'pagamento.situacao': 2 } },
                { session: mongoSession },
                );
                if (userUpdate.matchedCount !== 1) {
                    throw new Error('PAYMENT_SESSION_OWNER_UPDATE_FAILED');
                }
                const assignmentUpdated = await updatePaymentAssignment(
                    db,
                    sessionId,
                    'PAGAMENTO_PENDENTE',
                    { metodo: 'PIX', checkoutId: gatewayBody.id },
                    mongoSession,
                );
                if (!assignmentUpdated) throw new Error('PAYMENT_ASSIGNMENT_UPDATE_FAILED');
                const assignmentValuesUpdate = await db.collection('pagamentos.atribuicoes').updateOne(
                    { compraId: sessionId },
                    {
                        $set: {
                            valorSelecionadoCentavos: {
                                original: lockedSession.valoresCentavos.original.PIX,
                                desconto: lockedSession.valoresCentavos.desconto.PIX,
                                final: lockedSession.valoresCentavos.final.PIX,
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
                { _id: sessionId, status: 'CREATING_PAYMENT' },
                {
                    $set: {
                        gatewayState: 'RECONCILIATION_REQUIRED',
                        orderId: gatewayBody.id,
                        paymentUrl: gatewayBody.link,
                        updatedAt: new Date(),
                    },
                },
            );
            throw transactionError;
        }

        return NextResponse.json(
            {
                success: true,
                paymentUrl: gatewayBody.link,
                checkoutId: gatewayBody.id,
                checkoutExpiresAt,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('Erro ao criar checkout PIX:', error);
        return NextResponse.json(
            { error: 'pix_checkout_failed', message: 'Não foi possível criar o checkout PIX.' },
            { status: 500 },
        );
    }
});
