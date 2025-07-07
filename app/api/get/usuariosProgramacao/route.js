import { connectToDatabase } from '../../../lib/mongodb'
import { NextResponse } from 'next/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { ObjectId } from 'mongodb';
import { getSession } from '@auth0/nextjs-auth0';
//
//
// Exemplo de return:
// {"data":{"isPos_registration":0,"informacoes_usuario":{"nome:":"","email":"mateus2.0@icloud.com","data_criacao":"2024-07-08T22:48:41.110Z"}}}
// Exemplo de return erro:
// 

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired (async function GET( request, { params } ) {
    try{
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|",""); // Retirando o auth0|  
        //
        // Já vem apenas com o replace.
        const { db } = await connectToDatabase();

        const [result1, result2, result3] = await Promise.all([
            db.collection('minicursos').find(
                { 
                    $or: [
                      { participants:{$in:[userId]} },
                      { "timeline.speakers": { $in: [userId] } }
                    ]
                },
                { projection: { 'participants':0 }}
            ).toArray(),
            db.collection('palestras').find(
                {}
            ).toArray(),
          ]);
        return NextResponse.json({ 
            "minicursos": result1 ?? [], // ICourse
            "palestras":result2 ?? [], // ILecture
        },{status:200});

    }
    catch (error){
        return NextResponse.json({"error": error})
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