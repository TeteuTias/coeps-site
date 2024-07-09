import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../lib/mongodb'
//
//
//Nome webwook -> pos_registration01
/**
 * É responsável por criar o "esqueleto do usuário no DB. é execudado sempre que um novo usuário é criado a mandado do Auth0.
 * Se ele não criar o esqueleto, não há como continuar na conta.
 */
export async function POST(request) {
    const { searchParams } = new URL(request.url)

    
    const email = searchParams.get('usuario_email');
    const user_id = searchParams.get('usuario_id').replace("auth0|","");
    const data_criacao = new Date()

    try {
        const { db } = await connectToDatabase();

        const result = await db.collection('usuarios').insertOne({
            "_id":new ObjectId(user_id),
            "isPos_registration":0,
            "informacoes_usuario":{
                "nome:":"",
                "email":email,
                "data_criacao":data_criacao,
            },
            
        });
        return Response.json({ "sucesso":"Ocorreu tudo certo" })
    }
    catch (error) {

        return Response.json({"erro":error})
    }
}