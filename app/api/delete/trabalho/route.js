import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { del } from '@vercel/blob';
import { workSubmissionIsOpen } from '@/lib/academic-work-files';

/** @type {any} */
export const DELETE = withApiAuthRequired(async function DELETE(request) {
    try {
        const session = await getSession(request);
        const subject = typeof session?.user?.sub === 'string'
            ? /^auth0\|([a-f\d]{24})$/i.exec(session.user.sub)
            : null;
        if (!subject) {
            return Response.json({ error: 'Sessão de usuário inválida.' }, { status: 401 });
        }
        const data = await request.json().catch(() => null);
        if (typeof data?.trabalhoId !== 'string' || !ObjectId.isValid(data.trabalhoId)) {
            return Response.json({ error: 'ID do trabalho inválido.' }, { status: 400 });
        }

        const userId = subject[1];
        const trabalhoId = new ObjectId(data.trabalhoId);
        const ownerQuery = { _id: trabalhoId, userId: new ObjectId(userId) };

        // Conectando ao banco de dados
        const { db } = await connectToDatabase();
        
        // Verificando se o trabalho existe e pertence ao usuário
        const trabalho = await db.collection('Dados_do_trabalho').findOne(ownerQuery);

        if (!trabalho) {
            return Response.json({ 
                error: "Trabalho não encontrado ou você não tem permissão para excluí-lo" 
            }, { status: 404 });
        }

        // Verificar se o período de submissão ainda está aberto
        const config = await db.collection('trabalhos_config').findOne({});
        if (!config) {
            return Response.json({ error: 'Configurações de trabalhos não encontradas.' }, { status: 500 });
        }
        if (!workSubmissionIsOpen(config)) {
            return Response.json({ 
                error: 'A exclusão de trabalhos só está disponível durante o período de submissão.'
            }, { status: 409 });
        }

        // Os IDs chegam como ObjectId ou string em submissões e correções antigas.
        const fileIds = (Array.isArray(trabalho.arquivos) ? trabalho.arquivos : [])
            .map(arquivo => String(arquivo?.fileId ?? ''))
            .filter(id => ObjectId.isValid(id))
            .map(id => new ObjectId(id));
        if (fileIds.length > 0) {
            const fileQuery = {
                _id: { $in: fileIds },
                userId,
                $or: [{ submissionId: trabalhoId }, { submissionId: { $exists: false } }],
            };
            // Use os URLs dos registros pertencentes ao dono, não URLs enviados pelo cliente.
            const files = await db.collection('trabalhos_blob').find(fileQuery).toArray();
            for (const file of files) {
                if (file.url) await del(file.url);
            }
            await db.collection('trabalhos_blob').deleteMany(fileQuery);
        }

        // Excluir o trabalho do banco de dados
        const deleteResult = await db.collection('Dados_do_trabalho').deleteOne(ownerQuery);

        if (deleteResult.deletedCount === 0) {
            return Response.json({ 
                error: "Não foi possível excluir o trabalho" 
            }, { status: 500 });
        }

        return Response.json({ 
            message: 'Trabalho excluído com sucesso!' 
        }, { status: 200 });

    } catch {
        return Response.json({ 
            error: "internal_server_error",
            message: "Não foi possível excluir o trabalho."
        }, { status: 500 });
    }
});
