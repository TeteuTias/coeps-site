import { NextApiRequest, NextApiResponse } from 'next';
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
    console.log("============== webhook 01 ================")
    console.log("AQUII")
    //
    //
    try {
        const requestData = await request.json() 
        console.log(requestData)
        return Response.json({ "message": 'success' },{status:200})
    }
    catch (error){
        console.log("ERROR")
        console.log(error)
        return Response.json({ "error": error },{status:500})
    }

}
