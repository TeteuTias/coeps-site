import { NextApiRequest, NextApiResponse } from 'next';
import { Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb';
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
    console.log("============== payment_notification_urls ================")
    const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY
    try {
        const requestData  = await request.json() 
        const reference_id = requestData.reference_id
        const _id          = new ObjectId(requestData.reference_id.split("|")[1])
        console.log(requestData)
        //
        //
        // Conectando ao DB e realizando update
        const { db } = await connectToDatabase()
        const collection = 'usuarios'

        const filter = {
            _id,
            "pagamento.lista_pagamentos.reference_id": reference_id
          };
          const isPayed = requestData.charges[0].status == "PAID"?{"pagamento.situacao":1}:{}
          const update = {
            $push: {
              "pagamento.lista_pagamentos.$[elem]._pagamentos": requestData
            },
            $set: {
                "pagamento.lista_pagamentos.$[elem]._ultimo_update":new Date().toISOString(),
                "pagamento.lista_pagamentos.$[elem].status":requestData.charges[0].status,
                ...isPayed
            },
            
          };
          const options = {
            arrayFilters: [{ "elem.reference_id": reference_id }]
          };
        //
        const result = await db.collection(collection).updateOne(filter, update, options);
        // 
        if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro. Ele vai como falha, entretanto não há problema, já que provavelmente, ele tentou acessar o documento antes que ele fosse criado. assim, ele já está pago e autorizado já que hook01 fez isso por ele.
            //console.log("result.matchedCount === 0")
            return Response.json({"erro":"result.matchedCount"}, {status:404})
            
            
        } else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
            //console.log("result.modifiedCount === 0")
            return Response.json({"erro":"result.modifiedCount === 0"}, {status:400})
        }
        // Desativando Checkout pelo link.
        const pipeline = [
            {
              $match: {
                _id,
                "pagamento.lista_pagamentos.reference_id": reference_id
              }
            },
            {
              $project: {
                links: 1,
                filtered_pagamentos: {
                  $filter: {
                    input: "$pagamento.lista_pagamentos",
                    as: "pagamento",
                    cond: { $eq: ["$$pagamento.reference_id", reference_id] }
                  }
                }
              }
            },
            {
              $project: {
                links: 1,
                "filtered_pagamentos.links": 1
              }
            }
          ];
      
        const result02 = await db.collection(collection).aggregate(pipeline).toArray();
        //
        //console.log(result02[0].filtered_pagamentos[0].links[2])
        const link = result02[0].filtered_pagamentos[0].links[2].href
        //
        const reponse_link_desativate = await fetch(link, {
        headers: {
            'accept': '*/*',
            'Authorization': `Bearer ${PAGBANK_API_KEY}`,
            'Content-Type': 'application/json'
        }
        });
        //

          

        //
        //
        return Response.json({ "message": 'success' },{status:200})
    }
    catch (error){
        console.log("ERROR")
        console.log(error)
        return Response.json({ "error": error },{status:500})
    }

}
