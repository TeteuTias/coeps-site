import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { del } from '@vercel/blob';
import { workSubmissionIsOpen } from '@/lib/academic-work-files';
import { runPaymentTransaction } from '@/lib/payments/transactions';

export const maxDuration = 60;

/** @type {any} */
export const DELETE = withApiAuthRequired(async function DELETE(request) {
    try {
        const session = await getSession(request);
        const subject = typeof session?.user?.sub === 'string'
            ? /^auth0\|([a-f\d]{24})$/i.exec(session.user.sub)
            : null;
        if (!subject) return Response.json({ error: 'Sessão de usuário inválida.' }, { status: 401 });
        const data = await request.json().catch(() => null);
        if (typeof data?.trabalhoId !== 'string' || !ObjectId.isValid(data.trabalhoId)) {
            return Response.json({ error: 'ID do trabalho inválido.' }, { status: 400 });
        }

        const userId = subject[1];
        const trabalhoId = new ObjectId(data.trabalhoId);
        const ownerQuery = { _id: trabalhoId, userId: new ObjectId(userId) };
        const { db, client } = await connectToDatabase();
        const jobs = db.collection('trabalhos_exclusoes');

        // Nenhum Blob é apagado antes do commit. O job guarda os URLs mesmo
        // se a função for interrompida logo após remover o trabalho do banco.
        const result = await runPaymentTransaction(client, async (mongoSession) => {
            const options = { session: mongoSession };
            const existingJob = await jobs.findOne(ownerQuery, options);
            // Retomadas (inclusive após o prazo) e repetições são idempotentes.
            if (existingJob) return { job: existingJob };
            const trabalho = await db.collection('Dados_do_trabalho').findOne(ownerQuery, options);
            if (!trabalho) return { response: Response.json({
                error: 'Trabalho não encontrado ou você não tem permissão para excluí-lo.',
            }, { status: 404 }) };
            const config = await db.collection('trabalhos_config').findOne({}, options);
            if (!config) return { response: Response.json({ error: 'Configurações de trabalhos não encontradas.' }, { status: 500 }) };
            if (!workSubmissionIsOpen(config)) return { response: Response.json({
                error: 'A exclusão de trabalhos só está disponível durante o período de submissão.',
            }, { status: 409 }) };

            const fileIds = (Array.isArray(trabalho.arquivos) ? trabalho.arquivos : [])
                .map(arquivo => String(arquivo?.fileId ?? ''))
                .filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
            const fileQuery = {
                _id: { $in: fileIds }, userId,
                $or: [{ submissionId: trabalhoId }, { submissionId: { $exists: false } }],
            };
            const files = fileIds.length
                ? await db.collection('trabalhos_blob').find(fileQuery, options).toArray() : [];
            const job = {
                ...ownerQuery, titulo: trabalho.titulo,
                pendingUrls: [...new Set(files.map(file => file.url).filter(Boolean))],
                status: 'PENDING', createdAt: new Date(),
            };
            await jobs.insertOne(job, options);
            if (fileIds.length) await db.collection('trabalhos_blob').deleteMany(fileQuery, options);
            // A escrita no mesmo documento força conflito/retry se uma correção
            // tiver sido gravada após a leitura; o retry captura os novos anexos.
            const deletion = await db.collection('Dados_do_trabalho').deleteOne(ownerQuery, options);
            if (deletion.deletedCount !== 1) throw new Error('Work changed during deletion');
            return { job };
        });
        if (result.response) return result.response;

        let cleanupPending = result.job.status !== 'COMPLETE';
        if (cleanupPending) {
            // Limita a espera pelo storage; URLs não confirmados permanecem no job.
            const abortSignal = AbortSignal.timeout(5_000);
            try {
                for (const url of result.job.pendingUrls) {
                    if (abortSignal.aborted) break;
                    try {
                        await del(url, { abortSignal });
                        // $pull é monotônico: retries concorrentes não repõem URLs.
                        await jobs.updateOne(ownerQuery, { $pull: { pendingUrls: url } });
                    } catch {
                        // A exclusão já foi confirmada; mantenha a limpeza recuperável.
                    }
                }
                const completed = await jobs.updateOne({ ...ownerQuery, pendingUrls: { $size: 0 } }, {
                    $set: { status: 'COMPLETE', completedAt: new Date() },
                });
                cleanupPending = completed.matchedCount === 0;
            } catch {
                cleanupPending = true;
            }
        }
        return Response.json({
            message: cleanupPending
                ? 'O trabalho foi excluído. A limpeza de alguns arquivos está pendente; tente novamente pelo painel.'
                : 'O trabalho e seus arquivos foram excluídos com sucesso.',
            cleanupPending,
        });
    } catch {
        return Response.json({ error: 'internal_server_error', message: 'Não foi possível confirmar a exclusão do trabalho. Atualize a lista antes de tentar novamente.' }, { status: 500 });
    }
});
