import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { getUserId } from '@/lib/getUserId';
import { connectToDatabase } from '@/lib/mongodb';
import {
    PaymentCodeError,
    enforcePaymentCodePreviewRateLimit,
    previewPaymentCodes,
} from '@/lib/payments/codes';
import {
    getActivePaymentConfig,
    getCurrentAutomaticLot,
    getEditionId,
    isPaymentSalesOpen,
} from '@/lib/payments/config';
import {
    buildManualPaymentLot,
    PaymentOfferError,
    resolvePaymentOffer,
} from '@/lib/payments/offer';

export const dynamic = 'force-dynamic';

export const POST = withApiAuthRequired(async function POST(request: Request) {
    try {
        const userId = await getUserId(request);
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json(
                { error: 'not_authenticated', message: 'Sessão inválida.' },
                { status: 401 },
            );
        }

        const body = await request.json();
        const { db } = await connectToDatabase();
        const config = await getActivePaymentConfig(db);

        if (!config) {
            return NextResponse.json(
                { error: 'payment_config_not_found', message: 'Configuração não encontrada.' },
                { status: 404 },
            );
        }

        if (!isPaymentSalesOpen(config)) {
            return NextResponse.json(
                { error: 'payment_sales_closed', message: 'As inscrições não estão abertas.' },
                { status: 409 },
            );
        }

        const edicaoId = getEditionId(config);
        await enforcePaymentCodePreviewRateLimit(db, new ObjectId(userId));
        const codes = await previewPaymentCodes(db, {
            edicaoId,
            codigoDesconto: body.codigoDesconto,
            codigoRastreio: body.codigoRastreio,
        });
        const currentLot =
            config.modo === 'manual'
                ? buildManualPaymentLot(config)
                : await getCurrentAutomaticLot(db, config);
        const offer = resolvePaymentOffer({
            config,
            currentLot,
            discount: codes.desconto,
        });

        if (
            offer.perfilUtilizador !== 'ORGANIZADOR' &&
            body.loteCodigo !== undefined &&
            Number(body.loteCodigo) !== Number(offer.originalLot.codigo)
        ) {
            return NextResponse.json(
                {
                    error: 'payment_lot_changed',
                    message: 'O lote vigente foi atualizado. Recarregue os valores.',
                    loteVigente: offer.originalLot,
                },
                { status: 409 },
            );
        }

        return NextResponse.json(
            {
                edicaoId,
                codigos: {
                    desconto: codes.desconto
                        ? {
                              codigo: codes.desconto.codigo,
                              percentualDesconto: codes.desconto.percentualDesconto,
                              perfilUtilizador: codes.desconto.perfilUtilizador,
                          }
                        : undefined,
                    rastreio: codes.rastreio
                        ? { codigo: codes.rastreio.codigo }
                        : undefined,
                },
                lote: {
                    original: offer.originalLot,
                    final: offer.finalLot,
                },
                valoresCentavos: offer.amounts,
                perfilUtilizador: offer.perfilUtilizador,
                origemPreco: offer.origemPreco,
            },
            { status: 200 },
        );
    } catch (error) {
        if (error instanceof PaymentCodeError || error instanceof PaymentOfferError) {
            return NextResponse.json(
                { error: error.code, message: error.message },
                { status: error.status },
            );
        }

        console.error('Erro ao validar códigos de pagamento:', error);
        return NextResponse.json(
            { error: 'payment_code_preview_failed', message: 'Não foi possível validar o código.' },
            { status: 500 },
        );
    }
});
