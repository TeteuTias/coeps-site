import { connectToDatabase } from '../../lib/mongodb'
//
//

export async function GET( request, { params } ) {

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('usuarios').insertOne({
            
                "_id":user_id,
                "user_email":email,
            
        });
        return Response.json({ "Olá":"Mundo" })
    }
    catch (error) {
        console.log(":C")
        console.log(error)

        return Response.json({"Algo deu errado":error})
    }
}