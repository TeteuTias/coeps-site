
// submit work
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type ClientSession, type Db } from 'mongodb';
import { IAcademicWorks, IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import {
    normalizeAuthorEmail,
    normalizeParticipationMode,
    purchaserIsRemoteAuthor,
    validateAcademicWorkAuthors,
    validateAcademicWorkLimits,
} from '@/lib/academic-work-submission';
import { getActivePaymentConfig, getEditionId } from '@/lib/payments/config';
import { runPaymentTransaction } from '@/lib/payments/transactions';
import { findRemoteWorkAccess, REMOTE_WORK_SUBMISSION_LOCKS_COLLECTION } from '@/lib/remote-work-access';

class SubmissionError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
        super(message);
    }
}

async function verificarSeExisteAutorPagante(db: Db, autores: Array<Record<string, any>>) {
    if (!autores || autores.length === 0) {
        return false;
    }
    const cpfs = autores.map(a => a.cpf?.replace(/[^\d]/g, "")).filter(Boolean);
    const emails = autores.map(a => a.email?.toLowerCase()).filter(Boolean);

    if (cpfs.length === 0 && emails.length === 0) {
        return false;
    }

    const queryConditions = [];
    if (cpfs.length > 0) {
        queryConditions.push({ "informacoes_usuario.cpf": { $in: cpfs } });
    }
    if (emails.length > 0) {
        queryConditions.push({ "informacoes_usuario.email": { $in: emails } });
    }

    if (queryConditions.length === 0) {
        return false;
    }

    const finalQuery = {
        $and: [
            { $or: queryConditions },
            {
                $or: [
                    { "pagamento.situacao": 1 },
                    { "pagamento.situacao_animacao": 1 }
                ]
            }
        ]
    };
    const paganteEncontrado = await db.collection("usuarios").findOne(finalQuery);
    return !!paganteEncontrado;
}

// NOVA FUNÇÃO: Validar e buscar informações de múltiplos arquivos
async function validarArquivos(
    db: Db,
    fileIds: unknown[],
    userId: string,
    mongoSession: ClientSession,
) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new SubmissionError('files_required', 'Lista de arquivos inválida ou vazia.', 400);
    }

    // Converter strings para ObjectId
    const objectIds = fileIds.map(id => {
        try {
            return new ObjectId(String(id));
        } catch (error) {
            throw new SubmissionError('invalid_file_id', `ID de arquivo inválido: ${id}`, 400);
        }
    });

    // Buscar todos os arquivos no banco
    const arquivos = await db.collection('trabalhos_blob').find({
        _id: { $in: objectIds },
        userId: userId,
        submissionId: { $exists: false },
    }, { session: mongoSession }).toArray();

    // Verificar se todos os arquivos foram encontrados
    if (arquivos.length !== fileIds.length) {
        const arquivosEncontrados = arquivos.map(a => a._id.toString());
        const arquivosNaoEncontrados = fileIds.filter(id => !arquivosEncontrados.includes(String(id)));
        throw new SubmissionError('files_not_owned', `Arquivos não encontrados, já utilizados ou não pertencem ao usuário: ${arquivosNaoEncontrados.join(', ')}`, 409);
    }

    return arquivos;
}

export const POST: any = withApiAuthRequired(async function POST(request) {
    const session = await getSession(request);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }
    const userId = session.user.sub.replace("auth0|", "");
    if (!ObjectId.isValid(userId)) {
        return NextResponse.json({ error: 'Sessão de usuário inválida.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { db, client } = await connectToDatabase();
        const owner = new ObjectId(userId);
        const participationMode = normalizeParticipationMode(body.participationMode);
        const [paymentConfig, ownerUser] = await Promise.all([
            getActivePaymentConfig(db),
            db.collection('usuarios').findOne(
                { _id: owner },
                {
                    projection: {
                        'informacoes_usuario.nome': 1,
                        'informacoes_usuario.email': 1,
                        'informacoes_usuario.cpf': 1,
                    },
                },
            ),
        ]);
        if (!paymentConfig) {
            throw new SubmissionError('payment_config_not_found', 'Configuração da edição não encontrada.', 404);
        }
        const editionId = getEditionId(paymentConfig);
        const currentRemoteAccess = participationMode === 'REMOTE'
            ? await findRemoteWorkAccess(db, owner, editionId)
            : null;
        const authenticatedEmail = ownerUser?.informacoes_usuario?.email ||
            currentRemoteAccess?.purchaser?.email ||
            session.user.email;

        // Validação de autores (mantém a funcionalidade existente)
        if (body.action === 'validate') {
            if (participationMode === 'REMOTE') {
                const access = await findRemoteWorkAccess(db, owner, editionId, { activeOnly: true });
                const authorized = Boolean(
                    access && purchaserIsRemoteAuthor(body.autores || [], authenticatedEmail),
                );
                return NextResponse.json({ temPagante: authorized, authorized });
            }
            const temPagante = await verificarSeExisteAutorPagante(db, body.autores || []);
            return NextResponse.json({ temPagante, authorized: temPagante });
        }

        // MODIFICAÇÃO: Aceitar tanto fileId (compatibilidade) quanto fileIds (novo)
        const { titulo, modalidadeId, autores, fileId, fileIds, topicos } = body;

        //return Response.json({ message: "" }, { status: 500 })

        if (!titulo || !ObjectId.isValid(modalidadeId) || !Array.isArray(autores) || autores.length === 0) {
            return NextResponse.json({ error: 'Dados do formulário inválidos ou incompletos.' }, { status: 400 });
        }
        // Vamos puxar diretamente o DB as informações confiáveis sobre as propriedades da modalidade
        const trabalhoProps: IAcademicWorksProps = await db.collection("trabalhos_config").findOne({}); // só tem uma configuração, então ele só vai retornar uma...
        if (!trabalhoProps) {
            return NextResponse.json({ message: 'As configurações dos trabalhos não foram encontradas.' }, { status: 404 });
        }
        const modalidadeAtual = trabalhoProps.modalidades?.find(m => `${m._id}` === `${modalidadeId}`);
        if (!modalidadeAtual) {
            return NextResponse.json({ message: 'A modalidade selecionada não foi encontrada. Caso o erro persista, entre em contato com o Suporte.' }, { status: 404 });
        }
        const authorValidation = validateAcademicWorkAuthors(autores, modalidadeAtual);
        if (authorValidation.ok === false) {
            throw new SubmissionError('invalid_authors', authorValidation.message, 422);
        }
        //

        // MODIFICAÇÃO: Determinar quais IDs de arquivo usar
        let arquivosIds;
        if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
            // Novo formato: múltiplos arquivos
            arquivosIds = fileIds;
        } else if (fileId) {
            // Formato antigo: um único arquivo (compatibilidade)
            arquivosIds = [fileId];
        } else {
            return NextResponse.json({ error: 'Nenhum arquivo foi fornecido.' }, { status: 400 });
        }

        if (participationMode === 'REMOTE') {
            if (modalidadeAtual.permite_participacao_remota !== true) {
                throw new SubmissionError('remote_modality_not_allowed', 'A participação remota aceita somente Trabalho Completo.', 403);
            }
            if (!purchaserIsRemoteAuthor(autores, authenticatedEmail)) {
                throw new SubmissionError('remote_purchaser_not_author', 'O comprador do acesso remoto deve constar como autor do trabalho.', 403);
            }
        } else {
            const temPagante = await verificarSeExisteAutorPagante(db, autores);
            if (!temPagante) {
                throw new SubmissionError('paid_author_required', 'A submissão regular requer ao menos um autor com pagamento confirmado.', 402);
            }
        }

        const submissionId = new ObjectId();
        const modalityObjectId = new ObjectId(String(modalidadeId));
        const now = new Date();
        const result = await runPaymentTransaction(client, async (mongoSession) => {
            const remoteAccess = participationMode === 'REMOTE'
                ? await findRemoteWorkAccess(db, owner, editionId, { activeOnly: true })
                : null;
            if (participationMode === 'REMOTE' && (!remoteAccess?.purchaseId || remoteAccess.status !== 'ACTIVE')) {
                throw new SubmissionError('remote_access_not_active', 'O pagamento remoto precisa estar confirmado antes da submissão.', 402);
            }

            await db.collection(REMOTE_WORK_SUBMISSION_LOCKS_COLLECTION).updateOne(
                { userId: owner, editionId },
                { $inc: { version: 1 }, $set: { updatedAt: now }, $setOnInsert: { createdAt: now } },
                { upsert: true, session: mongoSession },
            );
            const editionScope = { $or: [{ editionId }, { editionId: { $exists: false } }] };
            const [totalCount, modalityCount] = await Promise.all([
                db.collection('Dados_do_trabalho').countDocuments(
                    { userId: owner, ...editionScope },
                    { session: mongoSession },
                ),
                db.collection('Dados_do_trabalho').countDocuments(
                    {
                        userId: owner,
                        ...editionScope,
                        $and: [{ $or: [{ modalidadeId: modalityObjectId }, { modalidade: modalidadeAtual.modalidade }] }],
                    },
                    { session: mongoSession },
                ),
            ]);
            const limitValidation = validateAcademicWorkLimits({
                totalCount,
                modalityCount,
                globalLimit: trabalhoProps.maximo_postagem_por_usuario,
                modalityLimit: modalidadeAtual.trabalhos_por_usuario,
            });
            if (limitValidation.ok === false) {
                throw new SubmissionError(limitValidation.code, limitValidation.message, 409);
            }

            const arquivosInfo = await validarArquivos(db, arquivosIds, userId, mongoSession);
            const arquivosData = arquivosInfo.map(arquivo => ({
                fileId: arquivo._id,
                fileName: arquivo.filename,
                url: arquivo.url,
                originalName: arquivo.originalName || arquivo.filename,
                size: arquivo.size || 0,
                uploadDate: arquivo.uploadDate || now,
            }));
            let purchaserLinked = false;
            const storedAuthors = autores.map((author) => {
                const isPurchaser = participationMode === 'REMOTE' &&
                    !purchaserLinked &&
                    author.isOrientador !== true &&
                    normalizeAuthorEmail(author.email) === normalizeAuthorEmail(authenticatedEmail);
                if (isPurchaser) purchaserLinked = true;
                return {
                    nome: isPurchaser
                        ? String(ownerUser?.informacoes_usuario?.nome || remoteAccess?.purchaser?.name || session.user.name || author.nome || '').trim()
                        : String(author.nome || '').trim(),
                    email: isPurchaser ? normalizeAuthorEmail(authenticatedEmail) : normalizeAuthorEmail(author.email),
                    cpf: isPurchaser
                        ? String(ownerUser?.informacoes_usuario?.cpf || remoteAccess?.purchaser?.cpf || author.cpf || '').replace(/\D/g, '')
                        : String(author.cpf || '').replace(/\D/g, ''),
                    isOrientador: author.isOrientador === true,
                    ...(isPurchaser ? { userId: owner } : {}),
                };
            });
            const dadosDoTrabalho: IAcademicWorks = {
                _id: submissionId,
                userId: owner,
                editionId,
                titulo: String(titulo).trim(),
                modalidadeId: modalityObjectId,
                modalidade: modalidadeAtual.modalidade,
                autores: storedAuthors as IAcademicWorks['autores'],
                arquivos: arquivosData,
                topicos: topicos ? {
                    resu: String(topicos.resumo || '').substring(0, 1000),
                    intro: String(topicos.introducao || '').substring(0, 1000),
                    obj: String(topicos.objetivo || '').substring(0, 500),
                    met: String(topicos.metodo || '').substring(0, 1000),
                    disc: String(topicos.discussaoResultados || '').substring(0, 1500),
                    conc: String(topicos.conclusao || '').substring(0, 800),
                    pchave: String(topicos.palavrasChave || '').substring(0, 200),
                    ref: String(topicos.referencias || '').substring(0, 2000),
                } : null as unknown as IAcademicWorks['topicos'],
                status: 'Em Avaliação',
                dataSubmissao: now,
                avaliadorComentarios: [],
                totalArquivos: arquivosData.length,
                tamanhoTotalBytes: arquivosData.reduce((total, arquivo) => total + Number(arquivo.size || 0), 0),
                configuracaoModalidade: modalidadeAtual,
                participationMode,
                ...(remoteAccess ? {
                    remoteAccessId: remoteAccess._id,
                    remotePurchaseId: remoteAccess.purchaseId,
                    financialReviewStatus: 'CLEAR' as const,
                } : {}),
            };
            await db.collection('Dados_do_trabalho').insertOne(dadosDoTrabalho, { session: mongoSession });
            const fileUpdate = await db.collection('trabalhos_blob').updateMany(
                { _id: { $in: arquivosInfo.map(a => a._id) }, userId, submissionId: { $exists: false } },
                { $set: { submissionId, submissionDate: now, status: 'submitted' } },
                { session: mongoSession },
            );
            if (fileUpdate.modifiedCount !== arquivosInfo.length) {
                throw new SubmissionError('file_state_changed', 'Um arquivo mudou durante a submissão. Tente novamente.', 409);
            }
            return { insertedId: submissionId, arquivosData };
        });

        return NextResponse.json({
            success: true,
            message: `Trabalho submetido com sucesso! ${result.arquivosData.length} arquivo(s) anexado(s).`,
            data: {
                insertedId: result.insertedId,
                submissionId: submissionId,
                totalFiles: result.arquivosData.length,
                files: result.arquivosData.map(a => ({
                    fileName: a.fileName,
                    size: a.size
                }))
            }
        });
    } catch (error) {
        if (error instanceof SubmissionError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error('Erro ao submeter trabalho:', error);
        return NextResponse.json({ error: 'internal_server_error', message: 'Ocorreu um erro inesperado no servidor.' }, { status: 500 });
    }
});
