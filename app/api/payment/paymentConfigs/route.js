import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import {
  getActivePaymentConfig,
  getCurrentAutomaticLot,
  getEditionId,
} from '@/lib/payments/config';
import { expireOpenSessionsForOwner } from '@/lib/payments/codes';
import { toPublicPaymentSession } from '@/lib/payments/public-session';

export const dynamic = 'force-dynamic';

export const GET = withApiAuthRequired(async function GET(request) {
  try {
    const userId = await getUserId(request);
    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'not_authenticated', message: 'Sessão inválida.' },
        { status: 401 },
      );
    }

    const { db } = await connectToDatabase();
    const config = await getActivePaymentConfig(db);
    if (!config) {
      return NextResponse.json(
        { error: 'payment_config_not_found', message: 'Configuração não encontrada.' },
        { status: 404 },
      );
    }

    const owner = new ObjectId(userId);
    const now = new Date();
    const edicaoId = getEditionId(config);
    await expireOpenSessionsForOwner(db, owner, now, edicaoId);
    const [currentLot, activeSession] = await Promise.all([
      getCurrentAutomaticLot(db, config, now),
      db.collection('pagamentos.sessoes').findOne({
        owner,
        edicaoId,
        type: 'ticket',
        $or: [
          { status: 'OPEN', expiresAt: { $gt: now } },
          {
            status: {
              $in: ['CREATING_PAYMENT', 'PAYMENT_PENDING', 'PAYMENT_REVIEW_REQUIRED'],
            },
          },
        ],
      }),
    ]);

    return NextResponse.json(
      {
        ...config,
        edicaoId,
        loteAutomaticoAtual: currentLot,
        sessaoPagamentoAutomáticoAtiva: toPublicPaymentSession(activeSession),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Erro ao carregar configuração de pagamento:', error);
    return NextResponse.json(
      { error: 'payment_config_failed', message: 'Não foi possível carregar os pagamentos.' },
      { status: 500 },
    );
  }
});
