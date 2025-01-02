import AWS from "aws-sdk"
import { withApiAuthRequired } from "@auth0/nextjs-auth0";

const r2 = new AWS.S3({
    endpoint: process.env.r2_endpoint_url, // Substitua <ACCOUNT_ID> pelo ID da sua conta Cloudflare
    accessKeyId: process.env.r2_access_key, // Defina as chaves no .env.local
    secretAccessKey: process.env.r2_secret_key,
    region: "auto", // R2 não exige região específica
    signatureVersion:"v4"
});


export const GET = withApiAuthRequired(async function GET(request, { params }) {
    const idComponente = params["_id"];
    const bucketName = process.env.r2_bucket_name

    try {
        const getObjectParams = {
            Bucket: bucketName,
            Key: `coeps2024/${idComponente}.pdf`, // A chave do objeto no bucket,
            Expires: 60 * 60,
        };
        const downloadUrl = r2.getSignedUrl("getObject", getObjectParams);



        return Response.json({ message: downloadUrl })
    } catch (err) {
        return Response.json({ message: err.message }, { status: 500 })

    }

})