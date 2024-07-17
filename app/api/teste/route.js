// pages/api/upload.js
import { connectToDatabase } from '@/app/lib/mongodb';
import { getSession } from '@auth0/nextjs-auth0';

//
// //await fs.writeFile(`./public/${file.name}`, buffer)
export async function POST(request, res) {
    try {
        // Verificando login antes de iniciar
        const { user } = await getSession();
        const _id = user.sub.replace("auth0|", "") // Retirando o auth0|  
        //
        //
        const formData = await request.formData()
        const files = formData.getAll("file")
        //
        // Verificando se há apenas 1 arquivo.
        if (files.length !== 1) {
            return Response.json({ 'erro': "Envie apenas um arquivo." }, { status: 400 });
        }

        // Como está em array, estou pegando o primeiro arquivo.
        const file = files[0]

        // Verificando se não excede o tamanho de 10mb
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            return Response.json({ 'erro': "O arquivo excede o limite máximo de 10MB por arquivo enviado." },
                {
                    status: 413, // 413 Payload Too Large
                })
        }
        //
        // Convertendo em 8array
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        // Conectando ao Db
        const { db } = await connectToDatabase()
        const collection = 'trabalhos'
        db.collection(collection).insertOne({
            name: file.name,
            size: file.size,
            user_id: _id,
            buffer
        })


        return Response.json({ "data": {
            name: file.name,
            user_id: _id,
        } }, { status: 200 })

    }
    catch (err) {
        console.log(err)
        return Response.json({ "erro": err }, { status: 500 })
    }



}
