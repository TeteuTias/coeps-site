import AWS from "aws-sdk"
import { withApiAuthRequired } from "@auth0/nextjs-auth0";

const r2 = new AWS.S3({
    endpoint: process.env.r2_endpoint_url, 
    accessKeyId: process.env.r2_access_key,
    secretAccessKey: process.env.r2_secret_key,
    region: "auto", 
    signatureVersion:"v4"
});

export const dynamic = 'force-dynamic'

export const GET = withApiAuthRequired(async function GET(request, { params }) {
    const idComponente = params["_id"];
    const bucketName = process.env.r2_bucket_name

    try {
        const getObjectParams = {
            Bucket: bucketName,
            Key: `coeps2024/${idComponente}.pdf`,
            Expires: 60 * 60,
        };
        const downloadUrl = r2.getSignedUrl("getObject", getObjectParams);



        return Response.json({ message: downloadUrl })
    } catch (err) {
        return Response.json({ message: err.message }, { status: 500 })

    }

})