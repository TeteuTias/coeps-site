import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { ObjectId } from 'mongodb';
import { mergePaymentHistory } from '@/lib/payments/payment-history';


import { getSession } from '@/lib/auth0-compat';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'


/** @type {any} */
export const GET = withApiAuthRequired(async function GET() {
    try {

        // Verificando se há sessão    
        // Puxando informações
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        //
        // Puxando informações de DB
        const { db } = await connectToDatabase();
        const owner = new ObjectId(userId);
        const result = await db.collection('usuarios').findOne(
            { _id: owner },
            {
                projection: {
                    "_id": 0,
                    "pagamento.situacao": 1,
                    "pagamento.lista_pagamentos.id": 1,
                    "pagamento.lista_pagamentos.dateCreated": 1,
                    "pagamento.lista_pagamentos.status": 1,
                    "pagamento.lista_pagamentos.value": 1,
                    "pagamento.lista_pagamentos.invoiceUrl": 1,
                    "pagamento.lista_pagamentos.invoiceNumber": 1,
                    "pagamento.lista_pagamentos.description": 1,
                    "pagamento.lista_pagamentos.billingType": 1,
                    "pagamento.lista_pagamentos._type": 1,
                    "pagamento.lista_pagamentos._eventID": 1,



                }
            },
        );
        const userPayment = result?.pagamento ?? {
            situacao: 0,
            lista_pagamentos: [],
            situacao_animacao: false,
            tipo_pagamento: '',
        };

        const assignments = await db.collection('pagamentos.atribuicoes')
            .find(
                { usuarioId: owner },
                {
                    projection: {
                        compraId: 1,
                        edicaoId: 1,
                        status: 1,
                        pagamento: 1,
                        valorSelecionadoCentavos: 1,
                        valoresCentavos: 1,
                        refundStatus: 1,
                        refundsSnapshot: 1,
                        chargebackStatus: 1,
                        chargebackResolution: 1,
                        paymentFailureStatus: 1,
                        financialReviewEvent: 1,
                        reviewRequiredAt: 1,
                        createdAt: 1,
                        updatedAt: 1,
                    },
                    sort: { createdAt: -1 },
                },
            )
            .toArray();
        const purchaseIds = assignments
            .map((assignment) => assignment.compraId)
            .filter((compraId) => compraId instanceof ObjectId);
        const sessions = purchaseIds.length
            ? await db.collection('pagamentos.sessoes')
                .find(
                    { _id: { $in: purchaseIds } },
                    {
                        projection: {
                            status: 1,
                            metodoPagamento: 1,
                            paymentId: 1,
                            invoiceNumber: 1,
                            orderId: 1,
                            paymentUrl: 1,
                            createdAt: 1,
                        },
                    },
                )
                .toArray()
            : [];

        const legacyPayments = Array.isArray(userPayment.lista_pagamentos)
            ? userPayment.lista_pagamentos
            : [];
        return NextResponse.json({
            data: {
                pagamento: {
                    ...userPayment,
                    situacao: userPayment.situacao ?? 0,
                    lista_pagamentos: mergePaymentHistory(legacyPayments, assignments, sessions),
                },
            },
        });

    }
    catch (error) {
        console.error('Falha ao carregar histórico de pagamentos', {
            error: error instanceof Error ? error.message.slice(0, 200) : 'unknown_error',
        });
        return NextResponse.json({ error: 'payment_history_failed' }, { status: 500 })
    }
})
/*
    try {
        const { db } = await connectToDatabase();
        
        const result = await db.collection('usuarios').find({}).toArray()
        
        return Response.json({ "Olá":result})
    }
    catch (error) {
        return Response.json({"Algo deu errado":error})
    }
*/
