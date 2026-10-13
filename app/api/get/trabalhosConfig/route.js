import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired, getSession } from '@/lib/auth0-compat';
import { ObjectId } from 'mongodb';
import { workSubmissionIsOpen } from '@/lib/academic-work-files';
import { getWorkSubmissionException } from '@/lib/work-submission-exception';
import { getActivePaymentConfig, getEditionId } from '@/lib/payments/config';
import { REMOTE_WORK_SUBMISSION_LOCKS_COLLECTION } from '@/lib/remote-work-access';

export const dynamic = 'force-dynamic';

/** @type {any} */
export const GET = withApiAuthRequired(async function GET(request) {
    try {
        const { db } = await connectToDatabase();
        const config = await db.collection('trabalhos_config').findOne({});
        if (!config) {
            return NextResponse.json({ error: 'Configuração de trabalhos indisponível.' }, { status: 404 });
        }
        let submissionExceptionExpiresAt = null;
        if (!workSubmissionIsOpen(config) && process.env.WORK_SUBMISSION_EXCEPTION) {
            const session = await getSession(request);
            const userId = session?.user?.sub?.replace('auth0|', '');
            if (userId && ObjectId.isValid(userId)) {
                const paymentConfig = await getActivePaymentConfig(db);
                const editionId = paymentConfig ? getEditionId(paymentConfig) : '';
                const exception = getWorkSubmissionException(userId, editionId, config);
                if (exception) {
                    const owner = new ObjectId(userId);
                    const [lock, existingWork] = await Promise.all([
                        db.collection(REMOTE_WORK_SUBMISSION_LOCKS_COLLECTION).findOne({ userId: owner, editionId }),
                        db.collection('Dados_do_trabalho').findOne({
                            userId: owner, $or: [{ editionId }, { editionId: { $exists: false } }],
                        }, { projection: { _id: 1 } }),
                    ]);
                    if ((!lock || !Object.hasOwn(lock, 'submissionException')) && !existingWork) {
                        submissionExceptionExpiresAt = exception.expiresAt.toISOString();
                    }
                }
            }
        }
        // This response is personal; the public config endpoint remains unchanged.
        return NextResponse.json({ ...config, submissionExceptionExpiresAt }, {
            headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
        });
    } catch (error) {
        console.error('Não foi possível consultar a configuração de trabalhos:', error);
        return NextResponse.json({
            error: 'internal_server_error',
            message: 'Não foi possível consultar as configurações de trabalhos.',
        }, { status: 500 });
    }
});
