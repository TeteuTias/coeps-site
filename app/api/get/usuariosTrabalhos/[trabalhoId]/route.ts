import { connectToDatabase } from '@/lib/mongodb';
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { ObjectId } from 'mongodb';

export const GET = withApiAuthRequired(async function GET(request: Request, { params }: { params: { trabalhoId: string } }) {
    try {
        const { trabalhoId } = params;
        if (!ObjectId.isValid(trabalhoId)) {
            throw new Error('Invalid trabalhoId');
        }
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        const { db } = await connectToDatabase();
        const query = { "_id": new ObjectId(trabalhoId), "userId": new ObjectId(userId) }
        const result = await db.collection('Dados_do_trabalho').findOne(
            query,
        )
        return Response.json({ data: result })
        // Simulação de dados de usuários que trabalharam no trabalho com o ID fornecido
    } catch (error) {
        return Response.json({ message: (error as Error).message }, { status: 500 });
    }

})