import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import { cancelPaymentSession } from '@/lib/payments/purchase-cancellation';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    const userId = await getUserId(request);
    const body = await request.json().catch(() => null);
    if (
        !userId ||
        !ObjectId.isValid(userId) ||
        !body?.sessionId ||
        !ObjectId.isValid(String(body.sessionId))
    ) {
        return NextResponse.json(
            {
                error: 'invalid_payment_session',
                message: 'Sessão de pagamento inválida.',
            },
            { status: 400 },
        );
    }

    const { db, client } = await connectToDatabase();
    const result = await cancelPaymentSession({
        db,
        client,
        owner: new ObjectId(userId),
        sessionId: new ObjectId(String(body.sessionId)),
        apiUrl: process.env.ASAAS_API_URL,
        apiKey: process.env.ASAAS_API_KEY,
    });

    if (result.kind === 'completed') {
        return NextResponse.json(
            { success: true, message: result.message },
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
