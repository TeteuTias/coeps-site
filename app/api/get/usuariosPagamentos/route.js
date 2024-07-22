import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken,withApiAuthRequired } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';


import { getSession } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 
export const GET = withApiAuthRequired(async function GET( request, { params } ) {
    try{
        
        // Verificando se há sessão    
        // Puxando informações
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|",""); // Retirando o auth0|  
        //
        // Puxando informações de DB
        const { db } = await connectToDatabase();
        const query  = {"_id":new ObjectId(userId) }
        const result = await db.collection('usuarios').find(
            query,
            { projection: { 
                "_id":0,
                "pagamento.situacao":1,
                "pagamento.lista_pagamentos.dateCreated":1,
                "pagamento.lista_pagamentos.status":1,
                "pagamento.lista_pagamentos.value":1,
                "pagamento.lista_pagamentos.invoiceUrl":1,
                "pagamento.lista_pagamentos.invoiceNumber":1,
                "pagamento.lista_pagamentos.description":1

                


            }}
        ).toArray()
        return NextResponse.json({ "data": result[0] });
        
    }
    catch (error){
        console.log(error)
        return NextResponse.json({"error": error}, {status:500})
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