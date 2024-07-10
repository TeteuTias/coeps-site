import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../../lib/mongodb'
import { ObjectId } from 'mongodb';
//
//
/**
 * RECEBE:
 *  charge.created -> Essa notificação é disparada quando uma cobrança é criada.
 * FUNÇÃO:
 *  Ele pega algumas informações do pagamento criado e joga lá no mongodb.
 */
//
export async function POST(request, response) {
    const requestData = await request.json() 
    //
    try {
        // Primeira fase da criação do documento de update - aqui vou adicionar as partes dos documentos que todos tem em comum;
        var update = {
            'id_hook_criador': requestData.id,
            'id_hook_modificador':undefined,
            'codigo_pedido': requestData.data.code,
            'valor': requestData.data.amount,
            'metodo_pagamento': requestData.data.payment_method,

            'data_criacao': requestData.created_at,
            'data_update': undefined,
            'status': requestData.data.order.status,
            'id_comprador': requestData.data.metadata._id,

        }
        switch(true){
            case requestData.data.payment_method == "pix":
                update["link_qrcode"] = requestData.data.last_transaction.qr_code
                update["link_qrcode_image"] = requestData.data.last_transaction.qr_code_url
                break                
            case requestData.data.payment_method == "boleto":
                update["linha_pagamento"] = requestData.data.last_transaction.line
                update["link_pdf"] = requestData.data.last_transaction.pdf
                update["link_url"] = requestData.data.last_transaction.url
                update["link_foto_codigo_de_barras"] = requestData.data.last_transaction.barcode
                update["link_foto_qrcode_codigo_de_barras"] = requestData.data.last_transaction.qr_code
                break
        }
        // Conectando ao DB.

        const { db } = await connectToDatabase();
        
        // Se ele já estiver pago ele já dá baixa. Haverá mesmo assim um hook02. Ele vai ficar como erro, mas tudo bem, já que já estará pago e liberado.
        // A unica diferença aqui é que ele coloca o proprio ID na atualização, a data de atualização e também coloca 1 em situacao
        if (requestData.data.order.status == "paid") {
            // Realizando complemento em update
            update['id_hook_modificador'] = requestData.id
            update['data_update'] = new Date()
            //

            //
            const result = await db.collection('usuarios').updateOne(
                {
                    "_id":new ObjectId(requestData.data.metadata._id),
                    'pagamento.lista_pagamentos.id_hook': { $ne: requestData.id }
                    
                },
                {"$push": { "pagamento.lista_pagamentos": 
                    {
                        "pagamento.situacao":1,
                        ...update
                    } 
                } }
            )
            return Response.json({ "sucesso": 'Ocorreu tudo certo' },{status:200});
        }
        const result = await db.collection('usuarios').updateOne(
            {
                "_id":new ObjectId(requestData.data.metadata._id),
                'pagamento.lista_pagamentos.id_hook': { $ne: requestData.id }
                
            },
            {"$push": { "pagamento.lista_pagamentos": update } }
        )
        //{"$push":{"pagamento.lista_pagamentos":update}}
        //console.log('ok')

        return Response.json({ "sucesso": 'Ocorreu tudo certo' },{status:200});


    }
    catch (error){
        //console.log(error)
        return Response.json({"erro":error},{status:500})
    }
}
/*
{
    id_hook_criador - id
    id_hook_modificador - id do ULTIMO MODIFICADOR
    codigo_pedido - data.code
    valor - data.code.amount/100
    metodo_pagamento - data.payment_method
        pix
        credit_card
    data_criacao - created_at
    data_update - undefined - fica assim pq quem vai atulizar é o webwook quando fazer o pagametno
    status - data.order.status
        waiting_payment
        payed?
        ...
    id_comprador: data.metadata._id // Corresponde ao _id do comprador. Esse é o id que está no db

    *daqui para baixo só se for pix: em 0 porque sempre vai ser somente um produto por compra.
        link_qrcode - data.last_transactoin.qr_code
        link_qrcode_image - data.last_transaction.qr_code_url
        
    *daqui para baixo só se for boleto: em 0 porque sempre vai ser somente um produto por compra.
        update["linha_pagamento"] = requestData.data.last_transaction.line
        update["link_pdf"] = requestData.data.last_transaction.pdf
        update["link_url"] = requestData.data.last_transaction.url
        update["link_foto_codigo_de_barras"] = requestData.data.last_transaction.barcode
        update["link_foto_qrcode_codigo_de_barras"] = requestData.data.last_transaction.qr_code
}
lista_id_hooks:[
    .id
],










/* Exemplo hook PIX
{
  id: 'hook_LjRMkbbc6BfLZqlN',
  account: { id: 'acc_qANKDm9UBziNRxyb', name: 'Loja on-line  - test' },
  type: 'charge.paid',
  created_at: '2024-07-10T02:33:42.8352271Z',
  data: {
    id: 'ch_AoDLnWwHVHPn0Nxz',
    code: 'YW6EHJH9WM',
    gateway_id: '707219',
    amount: 2990,
    paid_amount: 2990,
    status: 'paid',
    currency: 'BRL',
    payment_method: 'pix',
    paid_at: '2024-07-10T02:33:42.551877Z',
    created_at: '2024-07-10T02:33:42.4Z',
    updated_at: '2024-07-10T02:33:42.5893645Z',
    pending_cancellation: false,
    customer: {
      id: 'cus_Q2LebxBinimjVJoB',
      name: 'Tony Stark',
      email: 'avengerstark@ligadajustica.com.br',
      document: '01234567890',
      type: 'individual',
      delinquent: false,
      created_at: '2024-07-09T21:55:43.823Z',
      updated_at: '2024-07-09T22:10:45.58Z',
      phones: [Object],
      metadata: {}
    },
    order: {
      id: 'or_Z0E4xy8FBFGw13zW',
      code: 'YW6EHJH9WM',
      amount: 2990,
      closed: true,
      created_at: '2024-07-10T02:33:42.383Z',
      updated_at: '2024-07-10T02:33:42.5937044Z',
      closed_at: '2024-07-10T02:33:42.383Z',
      currency: 'BRL',
      status: 'paid',
      customer_id: 'cus_Q2LebxBinimjVJoB',
      metadata: {}
    },
    last_transaction: {
      transaction_type: 'pix',
      pix_provider_tid: '707219',
      qr_code: 'https://digital.mundipagg.com/pix/',
      qr_code_url: 'https://api.pagar.me/core/v5/transactions/tran_kK7n4dvijiwJdobx/qrcode?payment_method=pix',
      end_to_end_id: 'E12345678202009091221abcdef12345',
      payer: [Object],
      expires_at: '2026-03-05T12:23:55.4Z',
      id: 'tran_KEQrw6AHXHM9a7j0',
      gateway_id: '707219',
      amount: 2990,
      status: 'paid',
      success: true,
      created_at: '2024-07-10T02:33:42.5893645Z',
      updated_at: '2024-07-10T02:33:42.5893645Z',
      gateway_response: {},
      antifraud_response: {},
      metadata: {}
    },
    metadata: {}
  }
}




*/



