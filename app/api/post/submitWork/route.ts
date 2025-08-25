
// submit work
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'bson';
import { IAcademicWorks, IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';

async function verificarSeExisteAutorPagante(db, autores) {
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
async function validarArquivos(db, fileIds, userId) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new Error('Lista de arquivos inválida ou vazia.');
    }

    // Converter strings para ObjectId
    const objectIds = fileIds.map(id => {
        try {
            return new ObjectId(id);
        } catch (error) {
            throw new Error(`ID de arquivo inválido: ${id}`);
        }
    });

    // Buscar todos os arquivos no banco
    const arquivos = await db.collection('trabalhos_blob').find({
        _id: { $in: objectIds },
        userId: userId
    }).toArray();

    // Verificar se todos os arquivos foram encontrados
    if (arquivos.length !== fileIds.length) {
        const arquivosEncontrados = arquivos.map(a => a._id.toString());
        const arquivosNaoEncontrados = fileIds.filter(id => !arquivosEncontrados.includes(id));
        throw new Error(`Arquivos não encontrados ou não pertencem ao usuário: ${arquivosNaoEncontrados.join(', ')}`);
    }

    return arquivos;
}

export const POST = withApiAuthRequired(async function POST(request) {
    // @ts-expect-error: ts chato da porra kk
    const session = await getSession(request);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }
    const userId = session.user.sub.replace("auth0|", "");

    try {
        const body = await request.json();
        const { db } = await connectToDatabase();

        // Validação de autores (mantém a funcionalidade existente)
        if (body.action === 'validate') {
            const temPagante = await verificarSeExisteAutorPagante(db, body.autores);
            return NextResponse.json({ temPagante: temPagante });
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
        const modalidadeAtual = trabalhoProps.modalidades.find(m => `${m._id}` === `${modalidadeId}`);
        if (!modalidadeAtual) {
            return NextResponse.json({ message: 'A modalidade selecionada não foi encontrada. Caso o erro persista, entre em contato com o Suporte.' }, { status: 404 });
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

        const temPagante = await verificarSeExisteAutorPagante(db, autores);
        if (!temPagante) {
            return NextResponse.json(
                { error: 'A submissão requer que pelo menos um dos autores esteja cadastrado e com pagamento confirmado.' },
                { status: 402 }
            );
        }

        // MODIFICAÇÃO: Validar múltiplos arquivos
        const arquivosInfo = await validarArquivos(db, arquivosIds, userId);

        // MODIFICAÇÃO: Preparar dados dos arquivos para armazenamento
        const arquivosData = arquivosInfo.map(arquivo => ({
            fileId: arquivo._id,
            fileName: arquivo.filename,
            url: arquivo.url,
            originalName: arquivo.originalName || arquivo.filename,
            size: arquivo.size || 0,
            uploadDate: arquivo.uploadDate || new Date()
        }));

        // MODIFICAÇÃO: Gerar um ID único para a submissão
        const submissionId = new ObjectId();

        const dadosDoTrabalho: IAcademicWorks = {
            _id: submissionId, // ID único da submissão
            userId: new ObjectId(userId),
            titulo,
            modalidade: modalidadeAtual.modalidade,
            autores: autores.map(({ isPagante, ...resto }) => resto),
            // MODIFICAÇÃO: Armazenar múltiplos arquivos
            arquivos: [...arquivosData],
            topicos: topicos ? {
                resu: topicos.resumo?.substring(0, 1000) || '',
                intro: topicos.introducao?.substring(0, 1000) || '',
                obj: topicos.objetivo?.substring(0, 500) || '',
                met: topicos.metodo?.substring(0, 1000) || '',
                disc: topicos.discussaoResultados?.substring(0, 1500) || '',
                conc: topicos.conclusao?.substring(0, 800) || '',
                pchave: topicos.palavrasChave?.substring(0, 200) || '',
                ref: topicos.referencias?.substring(0, 2000) || ''
            } : null,
            status: "Em Avaliação",
            dataSubmissao: new Date(),
            avaliadorComentarios: [],
            // MODIFICAÇÃO: Metadados adicionais
            totalArquivos: arquivosData.length,
            tamanhoTotalBytes: arquivosData.reduce((total, arquivo) => total + (arquivo.size || 0), 0),
            configuracaoModalidade: modalidadeAtual // Será preenchido posteriormente se necessário
        };

        const result = await db.collection('Dados_do_trabalho').insertOne(dadosDoTrabalho);

        // MODIFICAÇÃO: Atualizar os arquivos para referenciar a submissão
        await db.collection('trabalhos_blob').updateMany(
            { _id: { $in: arquivosInfo.map(a => a._id) } },
            {
                $set: {
                    submissionId: submissionId,
                    submissionDate: new Date(),
                    status: 'submitted'
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: `Trabalho submetido com sucesso! ${arquivosData.length} arquivo(s) anexado(s).`,
            data: {
                insertedId: result.insertedId,
                submissionId: submissionId,
                totalFiles: arquivosData.length,
                files: arquivosData.map(a => ({
                    fileName: a.fileName,
                    size: a.size
                }))
            }
        });
    } catch (error) {
        console.error('Erro detalhado na submissão do trabalho:', error);

        // MODIFICAÇÃO: Melhor tratamento de erros específicos
        if (error.message.includes('ID de arquivo inválido') ||
            error.message.includes('Arquivos não encontrados')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ error: 'Ocorreu um erro inesperado no servidor.' }, { status: 500 });
    }
});
