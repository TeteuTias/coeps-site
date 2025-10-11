import { ObjectId } from 'bson';
import { connectToDatabase } from '@/app/lib/mongodb'
import { getSession } from '@auth0/nextjs-auth0';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { IAcademicWorks } from '@/app/utils/academicWorks/academicWorks.t';
import { ArquivoUpload } from '@/lib/types/academicWorks/academicWorks.t';
//
//
//
export const PUT = withApiAuthRequired(async function (req) {
    try {
        const { db } = await connectToDatabase();
        const { user } = await getSession();
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  

        // Extraindo os Dados
        const { academicWork, newFiles }: { academicWork: IAcademicWorks; newFiles: ArquivoUpload[] } = await req.json();
        const collection = "Dados_do_trabalho"
        //
        // Verificando Dados
        if (!ObjectId.isValid(userId)) {
            throw new Error("UserId is not valid.")
        }
        if (`${userId}` !== `${academicWork.userId}`) {
            throw new Error("UserId is not the work's owner.")
        }

        //
        const workData:IAcademicWorks = await db.collection(collection).findOne(
            {
                userId: new ObjectId(userId),
                _id: new ObjectId(academicWork._id)
            },
        )
        if (!workData) {
            throw new Error("AcademicWork not found.")
        }
        if (workData.status !== "Necessita de Alteração") {
            throw new Error("Não é possível realizar uma nova avaliação agora.")
        }
        //
        // Realizando Alteração
        await db.collection(collection).updateOne(
            {
                userId: new ObjectId(userId),
                _id: new ObjectId(academicWork._id)
            },
            {
                $set: {
                    status: "Em Avaliação",
                    topicos: academicWork.topicos,
                    totalArquivos: newFiles.length + workData.arquivos.length
                },
                $push: {
                    arquivos: {
                        $each: newFiles
                    }
                }
            }
        )

        //
        //
        //
        return Response.json({ academicWork, newFiles }, { status: 200 });
    }
    catch (error) {
        console.error(error);
        return Response.json({ message: 'Internal server error' }, { status: 500 });
    }
})
