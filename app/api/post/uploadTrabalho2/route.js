import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '../../../lib/mongodb'

async function getUserId() {
    const session = await getSession();

    return session?.user?.sub.replace("auth0|", "");
}

export async function POST(request, response) {


    const userId = await getUserId()

    const body = await request.json();

    const pathname = `/${userId}/trabalhos/`
    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
                // Generate a client token for the browser to upload the file
                // ⚠️ Authenticate and authorize users before generating the token.
                // Otherwise, you're allowing anonymous uploads.

                return {
                    allowedContentTypes: [
                        'application/msword',     // .doc
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
                        'application/vnd.ms-powerpoint', // .ppt
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
                        'application/pdf'         // .pdf
                    ],
                    tokenPayload: JSON.stringify({
                        userId: userId,         // ID do usuário autenticado
                        role: 'uploader',          // Papel do usuário
                        timestamp: Date.now(),    // Hora do upload
                        pathname: body.payload.pathname
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                // Get notified of client upload completion
                // ⚠️ This will not work on `localhost` websites,
                // Use ngrok or similar to get the full upload flow



                try {
                    const { userId, pathname } = JSON.parse(tokenPayload);

                    const { db } = await connectToDatabase();
                    await db.collection('trabalhos_blob').insertOne({
                        pathname: blob.pathname,
                        filename: pathname,
                        url: blob.url,
                        userId: userId,
                        uploadDate: new Date()
                    })
                    // Run any logic after the file upload completed
                    // const { userId } = JSON.parse(tokenPayload);
                    // await db.update({ avatar: blob.url, userId });

                } catch (error) {
                    throw new Error('Could not update user');
                }
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: " erro" },
            { status: 400 }, // The webhook will retry 5 times waiting for a status 200
        );
    }
}