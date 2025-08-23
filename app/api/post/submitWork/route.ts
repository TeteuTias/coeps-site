import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'bson';
import { IAcademicWorks, IAcademicWorksProps } from '@/lib/types/academicWorks/academicWorks.t';
import { isTodayBetweenDates } from '@/lib/isTodayBetweenDates';


//
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

interface IPayload {
    titulo: string,
    modalidadeId: string, // é um ObjectId mas vem no payload como uma string, por isso, deve ser validada corretamente
    autores: IAcademicWorks["autores"],
    fileId: string, // é um ObjectId mas vem no payload como uma string, por isso, deve ser validada corretamente
    topicos: {
        resumo: string,
        introducao: string,
        objetivo: string,
        metodo: string,
        discussaoResultados: string,
        conclusao: string,
        palavrasChave: string,
        referencias: string
    },
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

        // Puxando configurações gerais
        const trabalhosConfig: IAcademicWorksProps = await db.collection("trabalhos_config").findOne(
            {},
        )
        if (!trabalhosConfig) {
            throw new Error("Não foi encontrado nenhuma configuração de trabalhos")
        }

        // Organizando body
        const { titulo, autores, fileId, topicos, modalidadeId } = body;
        const payload: IPayload = {
            titulo,
            autores,
            fileId,
            topicos,
            modalidadeId
        }
        //
        // Verificando tipos
        if (!payload.titulo || !Array.isArray(payload.autores) || payload.autores.length === 0 || !payload.fileId || !ObjectId.isValid(payload.modalidadeId)) {
            return NextResponse.json({ error: 'Dados do formulário inválidos ou incompletos.' }, { status: 400 });
        }

        // Selecionando a configuração da modalidade
        const modalidadeConfig = trabalhosConfig.modalidades.find((mod) => `${mod._id}` === `${payload.modalidadeId}`)
        if (!modalidadeConfig) {
            throw new Error("As configurações da modalidade não foram encontradas")
        }
        //

        // Antes de tudo, dá tempo de postar mais um trabalho?
        /* LEMBRAR DE DESCOMENTAR ISSO!!!
        if (!isTodayBetweenDates(trabalhosConfig.data_inicio_submissao, trabalhosConfig.data_limite_submissao)) {
            throw new Error("Desculpe. O prazo para a postagem de trabalhos expirou.")
        }
        */
        // Agora, será que ele pode postar mais um, levando em consideração á quantidade total de postagens? 
        const trabalhosPostadosUsuario: IAcademicWorks[] = await db.collection("Dados_do_trabalho").find(
            {
                userId: new ObjectId(userId)
            },
        ).toArray()
        // ele atingiu o limite geral por postagem ?
        if (trabalhosPostadosUsuario.length >= trabalhosConfig.maximo_postagem_por_usuario) {
            throw new Error(`Desculpe, mas não é possível postar mais um trabalho, já que você já possui ${trabalhosPostadosUsuario.length} postados, e o limite total é de ${trabalhosConfig.maximo_postagem_por_usuario} postagens.`)
        }
        // Certo, agora por último, ele atingiu o limite por tipo de modalidade ?
        if (trabalhosPostadosUsuario.reduce((acc, value) => `${value._id}` === `${modalidadeConfig._id}` ? acc + 1 : acc, 0) >= modalidadeConfig.trabalhos_por_usuario) {
            throw new Error(`Desculpe, mas não é possível postar mais um trabalho, já que você já possui ${modalidadeConfig.trabalhos_por_usuario} postados na modalidade "${modalidadeConfig.modalidade}", e o limite total é de ${modalidadeConfig.trabalhos_por_usuario} postagens.`)
        }
        // Se chegou até aqui, é porque ele pode postar um trabalho. Agora, vamos para a validação dos dados

        // Usuário pagante ?
        if (body.action === 'validate') {
            const temPagante = await verificarSeExisteAutorPagante(db, body.autores);
            return NextResponse.json({ temPagante: temPagante });
        }

        // Usuário pagante ? - esse é quando realmente o usuário vai enviar um arquivo
        const temPagante = await verificarSeExisteAutorPagante(db, payload.autores);
        if (!temPagante) {
            return NextResponse.json(
                { error: 'A submissão requer que pelo menos um dos autores esteja cadastrado e com pagamento confirmado.' },
                { status: 402 }
            );
        }

        // os dados (autores_por_trabalho e maximo_orientadores) respeitam o modalidade ?
        if (payload.autores.length > modalidadeConfig.autores_por_trabalho) {
            throw new Error(`O número de autores deve ser no máximo${modalidadeConfig.autores_por_trabalho}.`)
        }
        if (payload.autores.reduce((acc, value) => value.isOrientador ? acc + 1 : acc, 0) > modalidadeConfig.maximo_orientadores) {
            throw new Error(`O número de orientadores deve ser no máximo ${modalidadeConfig.maximo_orientadores}.`)
        }

        const arquivoInfo = await db.collection('trabalhos_blob').findOne({
            _id: new ObjectId(payload.fileId),
            userId: userId
        });
        if (!arquivoInfo) {
            return NextResponse.json({ error: 'Arquivo associado não encontrado ou não pertence ao usuário.' }, { status: 404 });
        }

        const dadosDoTrabalho: Omit<IAcademicWorks, '_id'> = {
            userId: new ObjectId(userId),
            titulo: payload.titulo,
            modalidade: modalidadeConfig.modalidade,
            autores: payload.autores.map(({ isPagante, ...resto }) => resto),
            arquivo: {
                fileId: arquivoInfo._id,
                fileName: arquivoInfo.filename,
                url: arquivoInfo.url
            },
            topicos: payload.topicos ? {
                resu: payload.topicos.resumo?.substring(0, 1000) || '',
                intro: payload.topicos.introducao?.substring(0, 1000) || '',
                obj: payload.topicos.objetivo?.substring(0, 500) || '',
                met: payload.topicos.metodo?.substring(0, 1000) || '',
                disc: payload.topicos.discussaoResultados?.substring(0, 1500) || '',
                conc: payload.topicos.conclusao?.substring(0, 800) || '',
                pchave: payload.topicos.palavrasChave?.substring(0, 200) || '',
                ref: payload.topicos.referencias?.substring(0, 2000) || ''
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
        }, { status: 200 });
    } catch (error) {
        console.error('Erro detalhado na submissão do trabalho:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Ocorreu um erro inesperado no servidor.' }, { status: 500 });
    }
});