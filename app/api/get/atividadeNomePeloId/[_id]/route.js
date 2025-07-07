// pages/api/download.js
import { ObjectId, GridFSBucket } from 'mongodb';
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';


export const GET = withApiAuthRequired(async function GET(request, { params }) {
    try {
        const eventId = params["_id"];

        const { db } = await connectToDatabase();
        const result = await db.collection("minicursos").find(
            { "_id": new ObjectId(eventId) },

        ).toArray()

        return NextResponse.json({ data: result[0].name || "ERROR" }, { status: 200 });
        // result[0].name => ILecture["name"]

    } catch (error) {
        console.log(error.message);
        return new Response(JSON.stringify({ message: error.message || "Ocorreu um erro desconhecido. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
