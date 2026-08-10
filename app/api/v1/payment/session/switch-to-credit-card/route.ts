import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { switchPixSessionToCreditCard } from '@/lib/payments/pix-switch';
import { toPublicPaymentSession } from '@/lib/payments/public-session';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();

    const userId = await getUserId(request);
    const body = await request.json().catch(() => null);
    if (
        !userId ||
        !ObjectId.isValid(userId) ||
        !body?.sessionId ||
        !ObjectId.isValid(String(body.sessionId))
    ) {
        return NextResponse.json(
            { error: 'invalid_payment_session', message: 'SessÃ£o de pagamento invÃ¡lida.' },
            { status: 400 },
        );
    }

    const apiUrl = process.env.ASAAS_API_URL;
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiUrl || !apiKey) {
        return NextResponse.json(
            { error: 'payment_gateway_not_configured', message: 'Gateway nÃ£o configurado.' },
            { status: 503 },
        );
    }

    const { db, client } = await connectToDatabase();
    const result = await switchPixSessionToCreditCard({
        db,
        client,
        owner: new ObjectId(userId),
        sessionId: new ObjectId(String(body.sessionId)),
        apiUrl,
        apiKey,
    });

    if (result.kind === 'completed') {
        return NextResponse.json(
            {
                success: true,
                session: toPublicPaymentSession(result.session),
                message: 'PIX cancelado. Continue o pagamento com cartÃ£o.',
            },
            { status: 200 },
        );
    }
    const status = result.kind === 'pending'
        ? 202
        : result.kind === 'not_found'
            ? 404
            : 409;
    return NextResponse.json(
        { error: result.code, message: result.message },
        { status },
    );
});
