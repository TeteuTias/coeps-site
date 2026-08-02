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
import { applyDiscountToLot } from '@/lib/payments/prices';

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

        const currentLot =
            config.modo === 'manual'
                ? {
                      codigo: 0,
                      nome: config.nome,
                      limiteVagas: Number.MAX_SAFE_INTEGER,
                      precos: {
                          valorAVista: config.valorAVista,
                          valorPix: config.valorPix,
                          valorBoleto: config.valorBoleto,
                          valorDebito: config.valorDebito,
                          parcelamentos: config.parcelamentos ?? [],
                      },
                  }
                : await getCurrentAutomaticLot(db, config);
        if (!currentLot) {
            return NextResponse.json(
                { error: 'payment_lot_not_found', message: 'Nenhum lote está disponível.' },
                { status: 409 },
            );
        }

        if (
            body.loteCodigo !== undefined &&
            Number(body.loteCodigo) !== Number(currentLot.codigo)
        ) {
            return NextResponse.json(
                {
                    error: 'payment_lot_changed',
                    message: 'O lote vigente foi atualizado. Recarregue os valores.',
                    loteVigente: currentLot,
                },
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
        const discountPercent = codes.desconto?.percentualDesconto ?? 0;
        const discounted = applyDiscountToLot(currentLot, discountPercent);

        return NextResponse.json(
            {
                edicaoId,
                codigos: {
                    desconto: codes.desconto
                        ? {
                              codigo: codes.desconto.codigo,
                              percentualDesconto: codes.desconto.percentualDesconto,
                          }
                        : undefined,
                    rastreio: codes.rastreio
                        ? { codigo: codes.rastreio.codigo }
                        : undefined,
                },
                lote: {
                    original: currentLot,
                    final: discounted.lot,
                },
                valoresCentavos: discounted.amounts,
            },
            { status: 200 },
        );
    } catch (error) {
        if (error instanceof PaymentCodeError) {
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
