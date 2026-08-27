import { ObjectId } from 'mongodb';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import { syncPendingAsaasCustomer } from '@/lib/payments/customer-profile-sync';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    const userId = await getUserId(request);
    if (!userId || !ObjectId.isValid(userId)) {
        return Response.json({ error: 'not_authenticated' }, { status: 401 });
    }

    try {
        const { db } = await connectToDatabase();
        const result = await syncPendingAsaasCustomer({
            db,
            owner: new ObjectId(userId),
            userId,
            apiUrl: process.env.ASAAS_API_URL,
            apiKey: process.env.ASAAS_API_KEY,
        });
        return Response.json(result);
    } catch {
        return Response.json({ error: 'customer_sync_failed' }, { status: 500 });
    }
});
