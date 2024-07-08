import { connectToDatabase } from '../../lib/mongodb'
//
//

export async function POST(request) {
    const date = new Date()
    const data = await request.json()
    
    //console.log("================")
    //console.log(date.toString())
    //console.log(data)
    const { searchParams } = new URL(request.url)
    console.log(searchParams)
    //console.log("===============")
    
    const email = searchParams.get('email');
    const user_id = searchParams.get('user_id').replace("auth0|","");
    //const formData = await request.formData()
    //console.log(formData)
    //const name = formData.get('name')
    //const email = formData.get('email')
    try {
        const { db } = await connectToDatabase();
        console.log("Sucesso!")
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