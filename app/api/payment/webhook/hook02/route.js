



import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../../lib/mongodb'
import { ObjectId } from 'mongodb';
//
//
/**
 * RECEBE:
 *  charge.paid -> Essa notificação é disparada quando uma cobrança é paga.
 *
 * FUNÇÃO:
 *  Ele pega o pagamento que foi aprovado e registra no db e altera pagamento_situacao para 1, mostrando que o cliente pode entrar no site.  
*/
//
export async function POST(request, response) {
    try {
        const requestData = await request.json() 
        // Pegando informações e montando a query
        var query = {
            '_id': new ObjectId(requestData.data.metadata._id),
            'pagamento.lista_pagamentos.codigo_pedido':{$eq: requestData.data.code}
        }
        //
        // Conectando ao DB

        const { db } = await connectToDatabase();
        const result = await db.collection('usuarios').updateOne(
            query,
            {
                "$set": {
                    "pagamento.situacao": 1,
                    "pagamento.lista_pagamentos.$[elem].id_hook_modificador": requestData.id,
                    "pagamento.lista_pagamentos.$[elem].data_update": new Date(),
                    "pagamento.lista_pagamentos.$[elem].status": requestData.data.status
            }
            },
            {
                arrayFilters: [{ "elem.codigo_pedido": { $eq: requestData.data.code } }]
            }
            
        )
        if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro. Ele vai como falha, entretanto não há problema, já que provavelmente, ele tentou acessar o documento antes que ele fosse criado. assim, ele já está pago e autorizado já que hook01 fez isso por ele.
            //console.log("result.matchedCount === 0")
            return Response.json({"erro":"result.matchedCount"}, {status:404})
            
        } else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
            //console.log("result.modifiedCount === 0")
            return Response.json({"erro":"result.modifiedCount === 0"}, {status:400}) // Retorno 400 pois ele está configurado para sempre escrever.
        } else { //O documento foi atualizado com sucesso.
            // nao faz nada pq ja tem um status 200 abaixo.
        }

        return Response.json({"message":"sucesso"}, {status:200})

    }
    catch (error) {
        //console.log(error)
        return Response.json({"erro":error}, {status:500})
    }

}

/*




*/
