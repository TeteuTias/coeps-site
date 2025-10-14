import { ObjectId } from 'mongodb';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/lib/mongodb';
import { del } from '@vercel/blob';

export const DELETE = withApiAuthRequired(async function DELETE(request) {
    try {
        const { user } = await getSession();
        const data = await request.json();
        
        // Pegando IDs
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|
        const trabalhoId = data.trabalhoId;
        
        if (!trabalhoId) {
            return Response.json({ error: "ID do trabalho é obrigatório" }, { status: 400 });
        }

        // Conectando ao banco de dados
        const { db } = await connectToDatabase();
        
        // Verificando se o trabalho existe e pertence ao usuário
        const trabalho = await db.collection('trabalhos').findOne({ 
            _id: new ObjectId(trabalhoId),
            'autores.userId': userId 
        });

        if (!trabalho) {
            return Response.json({ 
                error: "Trabalho não encontrado ou você não tem permissão para excluí-lo" 
            }, { status: 404 });
        }

        // Verificar se o período de submissão ainda está aberto
        const { data_inicio_submissao, data_limite_submissao } = await getDatesFromDataBase();
        const isWithinSubmissionPeriod = await verifySubmissionPeriod(data_inicio_submissao, data_limite_submissao);
        
        if (!isWithinSubmissionPeriod) {
            return Response.json({ 
                error: "O período de submissão já foi encerrado. Não é possível excluir trabalhos após o prazo." 
            }, { status: 409 });
        }

        // Excluir arquivos do Vercel Blob
        if (trabalho.arquivos && trabalho.arquivos.length > 0) {
            for (const arquivo of trabalho.arquivos) {
                try {
                    if (arquivo.url) {
                        await del(arquivo.url);
                    }
                } catch (error) {
                    console.error(`Erro ao excluir arquivo ${arquivo.url}:`, error);
                    // Continue mesmo se um arquivo falhar
                }
            }
        }

        // Excluir registros de arquivos do banco
        if (trabalho.arquivos && trabalho.arquivos.length > 0) {
            const fileIds = trabalho.arquivos.map(arquivo => arquivo.fileId).filter(Boolean);
            if (fileIds.length > 0) {
                await db.collection('trabalhos_blob').deleteMany({ 
                    _id: { $in: fileIds },
                    userId: userId 
                });
            }
        }

        // Excluir o trabalho do banco de dados
        const deleteResult = await db.collection('trabalhos').deleteOne({ 
            _id: new ObjectId(trabalhoId),
            'autores.userId': userId 
        });

        if (deleteResult.deletedCount === 0) {
            return Response.json({ 
                error: "Não foi possível excluir o trabalho" 
            }, { status: 500 });
        }

        return Response.json({ 
            message: 'Trabalho excluído com sucesso!' 
        }, { status: 200 });

    } catch (error) {
        console.error('Erro ao excluir trabalho:', error);
        return Response.json({ 
            error: error.message || "Erro interno do servidor. Tente novamente mais tarde." 
        }, { status: 500 });
    }
});

// Função para verificar se está dentro do período de submissão
const verifySubmissionPeriod = async (data_inicio_submissao, data_limite_submissao) => {
    const dataAtual = new Date();
    dataAtual.setHours(new Date().getHours() - 3); // Ajuste de fuso horário

    const inicio = new Date(data_inicio_submissao);
    const limite = new Date(data_limite_submissao);

    return dataAtual >= inicio && dataAtual <= limite;
};

// Função para buscar as datas de submissão no banco de dados
const getDatesFromDataBase = async () => {
    const { db } = await connectToDatabase();
    const config = await db.collection('trabalhos_config').findOne({});
    
    if (!config) {
        throw new Error("Configurações de trabalhos não encontradas");
    }
    
    return {
        data_inicio_submissao: config.data_inicio_submissao,
        data_limite_submissao: config.data_limite_submissao
    };
};
