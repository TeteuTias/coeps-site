import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
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
    console.log("============== notification_urls ================")
    console.log("AQUII")
    //
    //
    try {
        const requestData = await request.json() 
        console.log(requestData)
        console.log(requestData.status)

        //
        if (requestData.status == "EXPIRED") {
            console.log("IF - EXPIRED")
            const _id = new ObjectId(requestData.reference_id.split("|")[1])
            const reference_id = requestData.reference_id
            const { db } = await connectToDatabase()
            const collection = 'usuarios'

            const filter = {
                _id,
                "pagamento.lista_pagamentos.reference_id": reference_id
            };
            const options = {
                arrayFilters: [{ "elem.reference_id": reference_id }]
              };
            const update = {
                "$set": {
                    "pagamento.situacao":0,
                    "pagamento.lista_pagamentos.$[elem].status":requestData.status,
                    "pagamento.lista_pagamentos.$[elem]._ultimo_update":new Date().toISOString()

                }
            }
            const result = await db.collection(collection).updateOne(filter, update, options);
            if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro. Ele vai como falha, entretanto não há problema, já que provavelmente, ele tentou acessar o documento antes que ele fosse criado. assim, ele já está pago e autorizado já que hook01 fez isso por ele.
                //console.log("result.matchedCount === 0")
                return Response.json({"erro":"result.matchedCount"}, {status:404})
                
                
            } else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
                //console.log("result.modifiedCount === 0")
                return Response.json({"erro":"result.modifiedCount === 0"}, {status:400})
            }
            

        }
        //
        //
        return Response.json({ "message": 'success' },{status:200})
    }
    catch (error){
        console.log("ERROR")
        console.log(error)
        return Response.json({ "error": error },{status:500}) // POR ALGUM MOTIVO ELE FICA MANDANDO POST SEM NENHUM CONTEÚDO JSON. ASSIM, FIZ ESSA GAMBIARRA PARA QUE ELE VEJA QUE FOI 200 E REFAZER A CONEXÃO.
    }

}
