import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';


async function verificarPagantes(db, autores) {
    // extrai os CPFs limpos 
    const cpfsDosAutores = autores.map(a => a.cpf.replace(/[^\d]/g, ""));


    const consultaPagantes = {
        // busca pelo CPF dentro 
        "informacoes_usuario.cpf": { $in: cpfsDosAutores },
        "pagamento.situacao": 1 
    };

    
    const pagantesEncontrados = await db.collection('usuarios').find(consultaPagantes).toArray();
    const cpfsDePagantes = pagantesEncontrados.map(p => p.informacoes_usuario.cpf);

    // isPagante'
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
        const { titulo, modalidade, autores, fileId, topicos } = body;

        if (!titulo || !modalidade || !autores || !autores.length || !fileId) {
            return NextResponse.json({ error: 'Dados do formulário incompletos.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Validação Nome e CPF
       
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
            // Tópicos do trabalho (otimizados para economia de espaço)
            topicos: topicos ? {
                intro: topicos.introducao?.substring(0, 1000) || '', // Lim  1000 cars
                obj: topicos.objetivo?.substring(0, 500) || '',      // Lim 500 cars
                met: topicos.metodo?.substring(0, 1000) || '',       // Lim a 1000 cars
                disc: topicos.discussaoResultados?.substring(0, 1500) || '', // Lim 1500 cars
                conc: topicos.conclusao?.substring(0, 800) || '',    // Lim 800 cars
                pchave: topicos.palavrasChave?.substring(0, 200) || '', // Lim 200 cars
                ref: topicos.referencias?.substring(0, 2000) || ''   // Lim 2000 cars
            } : null,
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