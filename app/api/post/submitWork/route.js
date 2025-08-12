import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';


async function verificarPagantes(db, autores) {
    // extrai os CPFs limpos dos autores do formulário
    const cpfsDosAutores = autores.map(a => a.cpf.replace(/[^\d]/g, ""));

    // Monta a consulta para encontrar usuários que são pagantes
    const consultaPagantes = {
        // Busca pelo CPF dentro do subdocumento
        "informacoes_usuario.cpf": { $in: cpfsDosAutores },
        // E verifica a situação do pagamento dentro do subdocumento 'pagamento'
        // IMPORTANTE: Ajuste "PAGO" para o valor exato que você usa no seu banco de dados (ex: "Aprovado", "Concluído")
        "pagamento.situacao": 1 
    };

    // executa a busca e obtém uma lista de CPFs que pertencem a usuários pagantes
    const pagantesEncontrados = await db.collection('usuarios').find(consultaPagantes).toArray();
    const cpfsDePagantes = pagantesEncontrados.map(p => p.informacoes_usuario.cpf);

    // Retorna a lista original de autores, com um novo campo 'isPagante'
    return autores.map(autor => {
        const cpfLimpo = autor.cpf.replace(/[^\d]/g, "");
        return {
            ...autor,
            isPagante: cpfsDePagantes.includes(cpfLimpo)
        };
    });
}

export const POST = withApiAuthRequired(async function POST(request) {
    const { user } = await getSession(request);
    const userId = user.sub.replace("auth0|", "");

    try {
        const body = await request.json();
        const { titulo, modalidade, autores, fileId } = body;

        if (!titulo || !modalidade || !autores || !autores.length || !fileId) {
            return NextResponse.json({ error: 'Dados do formulário incompletos.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Validação de Nome e CPF
       
        const condicoesDeBusca = autores.map(autor => ({
            "informacoes_usuario.nome": new RegExp(`^${autor.nome.trim()}$`, 'i'),
            "informacoes_usuario.cpf": autor.cpf.replace(/[^\d]/g, "")
        }));

        const consultaExistencia = { $or: condicoesDeBusca };
        const autoresCadastradosCount = await db.collection('usuarios').countDocuments(consultaExistencia);

        if (autoresCadastradosCount === 0) {
            return NextResponse.json(
                { error: 'A submissão requer que pelo menos um dos autores (com nome e CPF correspondentes) esteja cadastrado no sistema.' },
                { status: 403 }
            );
        }

        // verificação de pagamento
        const autoresComStatusPagamento = await verificarPagantes(db, autores);
        const temPagante = autoresComStatusPagamento.some(a => a.isPagante);

        if (!temPagante) {
            return NextResponse.json(
                { error: 'A submissão do trabalho requer que pelo menos um dos autores tenha o pagamento confirmado.' },
                { status: 402 } // 402 Payment Required
            );
        }

       
        const arquivoInfo = await db.collection('trabalhos_blob').findOne({ 
            _id: new ObjectId(fileId),
            userId: userId 
        });

        if (!arquivoInfo) {
            return NextResponse.json({ error: 'Arquivo associado não encontrado.' }, { status: 404 });
        }

        const dadosDoTrabalho = {
            userId,
            titulo,
            modalidade,
            autores: autoresComStatusPagamento,
            arquivo: {
                fileId: arquivoInfo._id,
                fileName: arquivoInfo.filename,
                url: arquivoInfo.url
            },
            status: "Em Avaliação",
            dataSubmissao: new Date(),
            avaliadorComentarios: ""
        };

        const result = await db.collection('Dados_do_trabalho').insertOne(dadosDoTrabalho);

        return NextResponse.json({ success: true, data: { insertedId: result.insertedId } });

    } catch (error) {
        console.error('Erro na submissão do trabalho:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno do servidor' },
            { status: 500 }
        );
    }
});
