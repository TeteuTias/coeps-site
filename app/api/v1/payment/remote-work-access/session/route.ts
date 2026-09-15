import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { createPaymentAssignment, hasConfirmedRegistrationForEdition, updatePaymentAssignment } from '@/lib/payments/codes';
import { getActivePaymentConfig, getEditionId, isPaymentSalesOpen } from '@/lib/payments/config';
import { preparePaymentCustomer } from '@/lib/payments/customer-sync';
import { toPublicPaymentSession } from '@/lib/payments/public-session';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import {
    REMOTE_WORK_ACCESS_COLLECTION,
    remoteWorkActiveKey,
    REMOTE_WORK_PRICE_CENTS,
    REMOTE_WORK_PRODUCT_TYPE,
} from '@/lib/remote-work-access';

const priceSnapshot = {
    original: { PIX: REMOTE_WORK_PRICE_CENTS, CREDIT_CARD: REMOTE_WORK_PRICE_CENTS, BOLETO: REMOTE_WORK_PRICE_CENTS, DEBIT_CARD: REMOTE_WORK_PRICE_CENTS },
    desconto: { PIX: 0, CREDIT_CARD: 0, BOLETO: 0, DEBIT_CARD: 0 },
    final: { PIX: REMOTE_WORK_PRICE_CENTS, CREDIT_CARD: REMOTE_WORK_PRICE_CENTS, BOLETO: REMOTE_WORK_PRICE_CENTS, DEBIT_CARD: REMOTE_WORK_PRICE_CENTS },
};

const productConfig = {
    codigo: -60,
    nome: 'Apresentação Remota de Trabalho - I CIEPS 2026',
    limiteVagas: 0,
    precos: {
        valorAVista: 60,
        valorPix: 60,
        valorBoleto: 60,
        valorDebito: 60,
        parcelamentos: [{ codigo: 1, valorCadaParcela: 60, totalParcelas: 1 }],
    },
};

function callbackUrl(path: string): string {
    const base = process.env.APP_BASE_URL?.replace(/\/$/, '');
    return base ? `${base}${path}` : process.env.ASAAS_URL_CALLBACK || '';
}

export const POST = withApiAuthRequired(async function POST(request: Request) {
    if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
    const authSession = await getSession(request);
    const userId = String(authSession?.user?.sub || '').replace(/^auth0\|/, '');
    if (!ObjectId.isValid(userId)) {
        return NextResponse.json({ error: 'not_authenticated', message: 'Sessão inválida.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const payerInput = body.payer ?? body;
        const { db, client } = await connectToDatabase();
        const config = await getActivePaymentConfig(db);
        if (!config) {
            return NextResponse.json({ error: 'payment_config_not_found', message: 'Configuração não encontrada.' }, { status: 404 });
        }
        const now = new Date();
        if (!isPaymentSalesOpen(config, now)) {
            return NextResponse.json({ error: 'payment_sales_closed', message: 'As inscrições não estão abertas.' }, { status: 409 });
        }
        const owner = new ObjectId(userId);
        const editionId = getEditionId(config);
        if (await hasConfirmedRegistrationForEdition(db, owner, editionId)) {
            return NextResponse.json(
                { error: 'regular_registration_already_confirmed', message: 'Sua inscrição regular já permite enviar trabalhos.' },
                { status: 409 },
            );
        }
        const access = await db.collection(REMOTE_WORK_ACCESS_COLLECTION).findOne({ userId: owner, editionId });
        if (!access?.proof || !['ELIGIBLE', 'PAYMENT_PENDING'].includes(String(access.status))) {
            if (access?.status === 'ACTIVE') {
                return NextResponse.json({ error: 'remote_access_already_active', message: 'Seu acesso remoto já está confirmado.' }, { status: 409 });
            }
            return NextResponse.json(
                { error: 'remote_access_not_eligible', message: 'Valide o município e envie o comprovante antes do pagamento.' },
                { status: 409 },
            );
        }

        await db.collection('pagamentos.sessoes').updateMany(
            {
                owner,
                edicaoId: editionId,
                type: REMOTE_WORK_PRODUCT_TYPE,
                status: 'OPEN',
                expiresAt: { $lte: now },
            },
            { $set: { status: 'EXPIRED', terminalAt: now, updatedAt: now }, $unset: { activeKey: '' } },
        );
        const activeSession = await db.collection('pagamentos.sessoes').findOne({
            owner,
            edicaoId: editionId,
            type: REMOTE_WORK_PRODUCT_TYPE,
            status: { $in: ['OPEN', 'CREATING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
        });
        if (activeSession) {
            return NextResponse.json({ success: true, session: toPublicPaymentSession(activeSession) }, { status: 200 });
        }

        const apiUrl = process.env.ASAAS_API_URL;
        const apiKey = process.env.ASAAS_API_KEY;
        if (!apiUrl || !apiKey) {
            return NextResponse.json({ error: 'payment_gateway_not_configured', message: 'Gateway não configurado.' }, { status: 503 });
        }
        const user = await db.collection('usuarios').findOne({ _id: owner }, { projection: { id_api: 1 } });
        const preparedCustomer = await preparePaymentCustomer({
            db,
            owner,
            userId,
            existingCustomerId: user?.id_api,
            payer: payerInput,
            email: authSession?.user?.email,
            apiUrl,
            apiKey,
        });
        if (preparedCustomer.ok === false) {
            return NextResponse.json(
                { error: preparedCustomer.code.toLowerCase(), message: preparedCustomer.message },
                { status: preparedCustomer.status },
            );
        }

        const purchaseId = new ObjectId();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
        const createdSession = {
            _id: purchaseId,
            activeKey: remoteWorkActiveKey(editionId, userId),
            owner,
            edicaoId: editionId,
            type: REMOTE_WORK_PRODUCT_TYPE,
            remoteAccessId: access._id,
            status: 'OPEN',
            expiresAt,
            createdAt: now,
            updatedAt: now,
            paymentConfigOriginal: productConfig,
            paymentConfig: productConfig,
            valoresCentavos: priceSnapshot,
            metodosPagamentoPermitidos: ['PIX', 'CREDIT_CARD'],
            callbackUrls: {
                successUrl: callbackUrl('/pagamentos/apresentacao-remota?payment=success'),
                cancelUrl: callbackUrl('/pagamentos/apresentacao-remota?payment=cancelled'),
                expiredUrl: callbackUrl('/pagamentos/apresentacao-remota?payment=expired'),
            },
            orderId: null,
            paymentUrl: null,
            pixCode: null,
            metodoPagamento: null,
            userProps: {
                name: preparedCustomer.payer.name,
                cpf: preparedCustomer.payer.cpfCnpj,
                zipCode: preparedCustomer.payer.postalCode,
                number: preparedCustomer.payer.addressNumber,
                complement: preparedCustomer.payer.complement || '',
                email: String(authSession?.user?.email || ''),
                phone: String(body?.payer?.phone || ''),
                street: '',
                neighborhood: '',
            },
        };

        try {
            await runPaymentTransaction(client, async (mongoSession) => {
                await db.collection('pagamentos.sessoes').insertOne(createdSession, { session: mongoSession });
                await createPaymentAssignment(db, {
                    compraId: purchaseId,
                    edicaoId: editionId,
                    usuarioId: owner,
                    type: REMOTE_WORK_PRODUCT_TYPE,
                    remoteAccessId: access._id,
                    valoresCentavos: priceSnapshot,
                    status: 'ABERTA',
                    createdAt: now,
                    updatedAt: now,
                }, mongoSession);
                const accessUpdate = await db.collection(REMOTE_WORK_ACCESS_COLLECTION).updateOne(
                    { _id: access._id, userId: owner, editionId, status: { $in: ['ELIGIBLE', 'PAYMENT_PENDING'] } },
                    {
                        $set: {
                            status: 'PAYMENT_PENDING',
                            purchaseId,
                            purchaser: {
                                userId: owner,
                                name: preparedCustomer.payer.name,
                                email: String(authSession?.user?.email || '').trim().toLowerCase(),
                                cpf: preparedCustomer.payer.cpfCnpj,
                            },
                            updatedAt: now,
                        },
                    },
                    { session: mongoSession },
                );
                if (accessUpdate.matchedCount !== 1) throw new Error('REMOTE_ACCESS_CHANGED');
            });
        } catch (error) {
            if ((error as { code?: number })?.code === 11000) {
                const concurrent = await db.collection('pagamentos.sessoes').findOne({
                    owner,
                    edicaoId: editionId,
                    type: REMOTE_WORK_PRODUCT_TYPE,
                    status: { $in: ['OPEN', 'CREATING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'] },
                });
                if (concurrent) {
                    return NextResponse.json({ success: true, session: toPublicPaymentSession(concurrent) }, { status: 200 });
                }
            }
            throw error;
        }
        return NextResponse.json({ success: true, session: toPublicPaymentSession(createdSession) }, { status: 201 });
    } catch (error) {
        console.error('Falha ao criar sessão de participação remota:', error);
        return NextResponse.json(
            { error: 'remote_payment_session_failed', message: 'Não foi possível iniciar o pagamento remoto.' },
            { status: 500 },
        );
    }
});
