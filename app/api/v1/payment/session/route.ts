import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import {
    PaymentCodeError,
    createPaymentAssignment,
    expireOpenSessionsForOwner,
    getTrackingCodeForPurchase,
    hasConfirmedRegistrationForEdition,
    normalizePaymentCode,
    releaseDiscountReservation,
    reserveDiscountCode,
} from '@/lib/payments/codes';
import {
    getActivePaymentConfig,
    getCurrentAutomaticLot,
    getEditionId,
    isPaymentSalesOpen,
    lockPaymentCapacityCalculation,
} from '@/lib/payments/config';
import { applyDiscountToLot } from '@/lib/payments/prices';
import { toPublicPaymentSession } from '@/lib/payments/public-session';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
    let reservedPurchaseId: ObjectId | null = null;

    try {
        const userId = await getUserId(request);
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: 'not_authenticated', message: 'Sessão inválida.' },
                { status: 401 },
            );
        }

        const body = await request.json();
        const {
            nome,
            cpf,
            cep,
            rua,
            numero,
            bairro,
            complemento,
            telefone,
            email,
            codigoDesconto,
            codigoRastreio,
        } = body;
        const loteCodigo = body.loteCodigo ?? body.loteAtualFrontEnd?.codigo;

        if (
            !nome ||
            !cpf ||
            !cep ||
            !rua ||
            !numero ||
            !bairro ||
            !telefone ||
            !email ||
            loteCodigo === undefined
        ) {
            return NextResponse.json(
                { error: 'invalid_payment_data', message: 'Preencha todos os campos obrigatórios.' },
                { status: 400 },
            );
        }

        const { db, client } = await connectToDatabase();
        const owner = new ObjectId(userId);
        const user = await db.collection('usuarios').findOne(
            { _id: owner },
            { projection: { id_api: 1 } },
        );

        if (!user?.id_api) {
            return NextResponse.json(
                { error: 'payment_customer_not_found', message: 'Cadastro de pagamento não encontrado.' },
                { status: 404 },
            );
        }

        const config = await getActivePaymentConfig(db);
        if (!config) {
            return NextResponse.json(
                { error: 'payment_config_not_found', message: 'Configuração não encontrada.' },
                { status: 404 },
            );
        }
        if (config.modo !== 'automatico') {
            return NextResponse.json(
                {
                    error: 'automatic_payment_disabled',
                    message: 'O fluxo automático de pagamento não está ativo.',
                },
                { status: 409 },
            );
        }
        const edicaoId = getEditionId(config);

        if (await hasConfirmedRegistrationForEdition(db, owner, edicaoId)) {
            return NextResponse.json(
                {
                    error: 'registration_already_confirmed',
                    message: 'Sua inscrição nesta edição já está confirmada.',
                },
                { status: 409 },
            );
        }

        const now = new Date();
        await expireOpenSessionsForOwner(db, owner, now, edicaoId);

        const activeSession = await db.collection('pagamentos.sessoes').findOne({
            owner,
            edicaoId,
            type: 'ticket',
            $or: [
                { status: 'OPEN', expiresAt: { $gt: now } },
                {
                    status: {
                        $in: [
                            'CREATING_PAYMENT',
                            'PAYMENT_PENDING',
                            'PAYMENT_REVIEW_REQUIRED',
                        ],
                    },
                },
            ],
        });

        if (activeSession) {
            const sameDiscount =
                normalizePaymentCode(codigoDesconto) ===
                normalizePaymentCode(activeSession.codigoDesconto?.codigo);
            const sameTracking =
                normalizePaymentCode(codigoRastreio) ===
                normalizePaymentCode(activeSession.codigoRastreio?.codigo);

            if (!sameDiscount || !sameTracking) {
                return NextResponse.json(
                    {
                        error: 'active_payment_session_has_different_codes',
                        message: 'Já existe uma sessão ativa com outros códigos.',
                        sessao: toPublicPaymentSession(activeSession),
                    },
                    { status: 409 },
                );
            }

            return NextResponse.json(
                {
                    success: true,
                    sessao: toPublicPaymentSession(activeSession),
                    message: 'Sessão ativa recuperada com sucesso.',
                },
                { status: 200 },
            );
        }

        if (!isPaymentSalesOpen(config, now)) {
            return NextResponse.json(
                {
                    error: 'payment_sales_closed',
                    message: 'As inscrições não estão abertas neste momento.',
                },
                { status: 409 },
            );
        }

        const currentLot = await getCurrentAutomaticLot(db, config, now);
        if (!currentLot || Number(currentLot.codigo) !== Number(loteCodigo)) {
            return NextResponse.json(
                {
                    error: 'payment_lot_changed',
                    message: 'O lote vigente foi atualizado. Clique no botão abaixo para recarregar os valores.',
                    loteVigente: currentLot,
                },
                { status: 409 },
            );
        }

        const compraId = new ObjectId();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

        let session;
        try {
            session = await runPaymentTransaction(client, async (mongoSession) => {
                await lockPaymentCapacityCalculation(db, config, mongoSession);
                const lockedLot = await getCurrentAutomaticLot(
                    db,
                    config,
                    now,
                    mongoSession,
                );
                if (!lockedLot || Number(lockedLot.codigo) !== Number(loteCodigo)) {
                    throw new PaymentCodeError(
                        'O lote vigente foi atualizado. Recarregue os valores.',
                        409,
                        'PAYMENT_LOT_CHANGED',
                    );
                }

                const discountSnapshot = codigoDesconto
                    ? await reserveDiscountCode(db, {
                          edicaoId,
                          codigo: codigoDesconto,
                          compraId,
                          usuarioId: owner,
                          reservadoAte: expiresAt,
                          mongoSession,
                      })
                    : undefined;
                if (discountSnapshot) reservedPurchaseId = compraId;

                const trackingSnapshot = codigoRastreio
                    ? await getTrackingCodeForPurchase(
                          db,
                          edicaoId,
                          codigoRastreio,
                          mongoSession,
                      )
                    : undefined;
                const discounted = applyDiscountToLot(
                    lockedLot,
                    discountSnapshot?.percentualDesconto ?? 0,
                );
                const createdSession = {
                    _id: compraId,
                    activeKey: `${edicaoId}:${userId}:ticket`,
                    owner,
                    edicaoId,
                    type: 'ticket',
                    status: 'OPEN',
                    expiresAt,
                    createdAt: now,
                    updatedAt: now,
                    paymentConfigOriginal: lockedLot,
                    paymentConfig: discounted.lot,
                    valoresCentavos: discounted.amounts,
                    metodosPagamentoPermitidos: config.pagamentosAceitos ?? [],
                    codigoDesconto: discountSnapshot,
                    codigoRastreio: trackingSnapshot,
                    orderId: null,
                    paymentUrl: null,
                    pixCode: null,
                    metodoPagamento: null,
                    userProps: {
                        name: String(nome),
                        cpf: String(cpf),
                        zipCode: String(cep),
                        phone: String(telefone),
                        email: String(email),
                        street: String(rua),
                        number: String(numero),
                        neighborhood: String(bairro),
                        complement: complemento ? String(complemento) : 'Não informado',
                    },
                };

                await db
                    .collection('pagamentos.sessoes')
                    .insertOne(createdSession, { session: mongoSession });
                await createPaymentAssignment(db, {
                    compraId,
                    edicaoId,
                    usuarioId: owner,
                    codigoDesconto: discountSnapshot,
                    codigoRastreio: trackingSnapshot,
                    valoresCentavos: discounted.amounts,
                    status: 'ABERTA',
                    createdAt: now,
                    updatedAt: now,
                }, mongoSession);

                return createdSession;
            });
        } catch (error) {
            await db.collection('pagamentos.sessoes').deleteOne({
                _id: compraId,
                status: 'OPEN',
            });
            if (reservedPurchaseId) {
                await releaseDiscountReservation(db, reservedPurchaseId);
                reservedPurchaseId = null;
            }

            if ((error as { code?: number })?.code === 11000) {
                const concurrentSession = await db.collection('pagamentos.sessoes').findOne({
                    owner,
                    edicaoId,
                    type: 'ticket',
                    status: {
                        $in: [
                            'OPEN',
                            'CREATING_PAYMENT',
                            'PAYMENT_PENDING',
                            'PAYMENT_REVIEW_REQUIRED',
                        ],
                    },
                });
                if (concurrentSession) {
                    const sameDiscount =
                        normalizePaymentCode(codigoDesconto) ===
                        normalizePaymentCode(concurrentSession.codigoDesconto?.codigo);
                    const sameTracking =
                        normalizePaymentCode(codigoRastreio) ===
                        normalizePaymentCode(concurrentSession.codigoRastreio?.codigo);
                    if (!sameDiscount || !sameTracking) {
                        throw new PaymentCodeError(
                            'Já existe uma sessão ativa com outros códigos.',
                            409,
                            'ACTIVE_PAYMENT_SESSION_HAS_DIFFERENT_CODES',
                        );
                    }
                    return NextResponse.json(
                        {
                            success: true,
                            sessao: toPublicPaymentSession(concurrentSession),
                            message: 'Sessão ativa recuperada com sucesso.',
                        },
                        { status: 200 },
                    );
                }
            }
            throw error;
        }

        reservedPurchaseId = null;
        return NextResponse.json(
            {
                success: true,
                sessao: toPublicPaymentSession(session),
                message: 'Nova sessão criada com sucesso.',
            },
            { status: 201 },
        );
    } catch (error) {
        if (reservedPurchaseId) {
            try {
                const { db } = await connectToDatabase();
                await releaseDiscountReservation(db, reservedPurchaseId);
            } catch (releaseError) {
                console.error('Erro ao compensar reserva de desconto:', releaseError);
            }
        }

        if (error instanceof PaymentCodeError) {
            return NextResponse.json(
                { error: error.code, message: error.message },
                { status: error.status },
            );
        }

        console.error('Erro ao processar sessão de pagamento:', error);
        return NextResponse.json(
            { error: 'payment_session_failed', message: 'Erro interno ao processar sessão.' },
            { status: 500 },
        );
    }
});
