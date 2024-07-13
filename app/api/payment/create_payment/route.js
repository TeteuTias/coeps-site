import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
//
//
//
//
//
export async function POST(request) {
    console.log(getBrasiliaTime())
    try {
        // Verificando se ele está logado
        // 
        const { accessToken } = await getAccessToken();
        //
        //
        const { user } = await getSession();
        const _id = new ObjectId(user.sub.replace("auth0|","")) // Retirando o auth0|  
        //
        // Tentando Criar Pagamento Checkout.
        //
        var reference_id = user.sub.replace("auth0",Math.floor(Math.random() * 1e11).toString() )

        const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY;
        const redirect_url = "https://www.google.com/"
        //const horario_limite = new Date(new Date().getTime()+ 10 * 60 * 1000) // 2023-08-14T19:09:10-03:00
        
        var response02 = await fetch('https://sandbox.api.pagseguro.com/checkouts', {
            method: 'POST',
            headers: {
              "accept": "*/*",
              'Authorization': `Bearer ${PAGBANK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify( 
              {
                "reference_id":reference_id,
                "expiration_date": "2024-07-12T22:50:10-03:00" ,
                "customer_modifiable": true,
                "items": [
                    {
                        "reference_id": "668ef50cce62095db191c767", 
                        "name": "IV COEPS - Primeiro Lote",
                        "quantity": 1,
                        "unit_amount": 13500,
                        "description":"Pagamento referente ao ingresso para a participação do IV COEPS - 2024"
                    }
                ],
                "additional_amount": 0,
                "discount_amount": 0,
                "payment_methods": [{ "type": "CREDIT_CARD" }, { "type": "BOLETO" }, { "type": "PIX" }],
                "soft_descriptor": "IV COEPS",
                "redirect_url": redirect_url,
                "return_url": redirect_url,
                "notification_urls": ["https://92fdeadeeee2.ngrok.app/api/teste06"],
                "payment_notification_urls": ["https://92fdeadeeee2.ngrok.app/api/payment/webhook/payment_notification"]
            }
  
            ),
        });
        var resposta = await response02.json();
        if (!response02.ok) {
            return Response.json({"erro":resposta}, {status:403})

        }
        //
        // Escrevendo resposta no DB
        const { db }    = await connectToDatabase()
        const colecao   = 'usuarios'
        var query       = {
            _id
        }
        const update = {
            "$push": {
                "pagamento.lista_pagamentos":{...resposta,"_pagamentos":[],"_ultimo_update":new Date().toISOString()}
            },
            "$set":{
                "pagamento.situacao":2
            }
        }
        const result = await db.collection(colecao).updateOne(query,update)

        if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
            
            return Response.json({"erro":"result.matchedCount === 0"}, {status:400})
            
        } else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
            //console.log("result.modifiedCount === 0")
            return Response.json({"erro":"result.modifiedCount === 0"}, {status:400}) // Retorno 400 pois ele está configurado para sempre escrever.
        }
        // Se chegou até aqui é porque deu tudo certo.
        // Pagamento criado e também lançado no db.
        // Resta agora, redirecionar o cliente para a tela de pagamento.

        return Response.json({"link":resposta.links[1].href},{status:200})
    }
    catch (error) {
        console.log(error)
        return Response.json({"erro":error}, {status:403})
    }
}
//
//
//
function getBrasiliaTime(minutesToAdd = 0) {
    const date = new Date();
  
    // Brasilia is 3 hours behind UTC
    const offset = -3;
  
    // Get the current UTC time in milliseconds
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  
    // Create a new date object for the Brasilia time
    const brasiliaTime = new Date(utcTime + (3600000 * offset));
  
    // Add the specified number of minutes to the Brasilia time
    brasiliaTime.setMinutes(brasiliaTime.getMinutes() + minutesToAdd);
  
    // Return the adjusted Brasilia time
    return brasiliaTime;
  }