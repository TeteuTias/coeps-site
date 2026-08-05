import type { ClientSession, MongoClient } from 'mongodb';

export async function runPaymentTransaction<T>(
    client: MongoClient,
    operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
    const session = client.startSession();

    try {
        let result: T | undefined;
        let completed = false;
        await session.withTransaction(
            async () => {
                result = await operation(session);
                completed = true;
            },
            {
                readConcern: { level: 'snapshot' },
                writeConcern: { w: 'majority' },
                readPreference: 'primary',
            },
        );

        if (!completed) {
            throw new Error('A transação financeira não foi confirmada.');
        }

        return result;
    } finally {
        await session.endSession();
    }
}
