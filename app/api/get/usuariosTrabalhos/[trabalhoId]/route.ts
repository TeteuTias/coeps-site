import { connectToDatabase } from '@/lib/mongodb';
import { withApiAuthRequired, getSession } from '@/lib/auth0-compat';
import { ObjectId } from 'mongodb';
import type { NextRequest } from 'next/server';

const protectedGet = withApiAuthRequired((async function GET(
    request: Request,
    { params }: { params: Promise<{ trabalhoId: string }> }
) {
    try {
        const { trabalhoId } = await params;
        if (!ObjectId.isValid(trabalhoId)) {
            return Response.json(
                { error: 'invalid_work_id', message: 'O identificador do trabalho é inválido.' },
                { status: 400 }
            );
        }
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
        const { db } = await connectToDatabase();
        const query = { "_id": new ObjectId(trabalhoId), "userId": new ObjectId(userId), status: "Necessita de Alteração" }
        const result = await db.collection('Dados_do_trabalho').findOne(
            query,
        )
        if (!result) {
            return Response.json(
                { error: 'work_not_available', message: 'Esse trabalho não necessita de alteração nesse momento.' },
                { status: 404 }
            );
        }
        return Response.json({ data: result })
        // Simulação de dados de usuários que trabalharam no trabalho com o ID fornecido
    } catch {
        return Response.json(
            { error: 'internal_server_error', message: 'Não foi possível consultar o trabalho.' },
            { status: 500 }
        );
    }

}) as any);

export const GET = protectedGet as unknown as (
    request: NextRequest,
    context: { params: Promise<{ trabalhoId: string }> }
) => Promise<Response> | Response;
