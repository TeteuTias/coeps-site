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

export const POST = withApiAuthRequired(async function POST(request) {
    //@ts-ignore: Chatisse do ts :|
    const session = await getSession(request);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    }
    const userId = session.user.sub.replace("auth0|", "");

    try {
        const body = await request.json();
        const { db } = await connectToDatabase();
        const trabalhosConfig: IAcademicWorksProps = await db.collection("trabalhos_config").findOne(
            {},
        )
        if (!trabalhosConfig) {
            throw new Error("Não foi encontrado nenhuma configuração de trabalhos")
        }

        if (body.action === 'validate') {
            const temPagante = await verificarSeExisteAutorPagante(db, body.autores);
            return NextResponse.json({ temPagante: temPagante });
        }

        const { titulo, autores, fileId, topicos, modalidadeId } = body;

        if (!titulo || !Array.isArray(autores) || autores.length === 0 || !fileId || !ObjectId.isValid(modalidadeId)) {
            return NextResponse.json({ error: 'Dados do formulário inválidos ou incompletos.' }, { status: 400 });
        }

        // Selecionando a configuração da modalidade
        const modalidadeConfig = trabalhosConfig.modalidades.find((mod) => `${mod._id}` === `${modalidadeId}`)
        if (!modalidadeConfig) {
            throw new Error("As configurações da modalidade não foram encontradas")
        }
        //

        const temPagante = await verificarSeExisteAutorPagante(db, autores);
        if (!temPagante) {
            return NextResponse.json(
                { error: 'A submissão requer que pelo menos um dos autores esteja cadastrado e com pagamento confirmado.' },
                { status: 402 }
            );
        }

        const arquivoInfo = await db.collection('trabalhos_blob').findOne({
            _id: new ObjectId(fileId),
            userId: userId
        });
        if (!arquivoInfo) {
            return NextResponse.json({ error: 'Arquivo associado não encontrado ou não pertence ao usuário.' }, { status: 404 });
        }

        const dadosDoTrabalho: IAcademicWorks = {
            userId,
            titulo,
            modalidade: modalidadeConfig.modalidade,
            autores: autores.map(({ isPagante, ...resto }) => resto),
            arquivo: {
                fileId: arquivoInfo._id,
                fileName: arquivoInfo.filename,
                url: arquivoInfo.url
            },
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
            configuracaoTrabalho: modalidadeConfig,
            avaliadorComentarios: []
        };

        const result = await db.collection('Dados_do_trabalho').insertOne(dadosDoTrabalho);

        return NextResponse.json({
            success: true,
            message: "Trabalho submetido com sucesso!",
            data: { insertedId: result.insertedId }
        });
    } catch (error) {
        console.error('Erro detalhado na submissão do trabalho:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Ocorreu um erro inesperado no servidor.' }, { status: 500 });
    }
});