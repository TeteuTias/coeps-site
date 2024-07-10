import { NextApiRequest, NextApiResponse } from 'next';

export async function POST(req, res) {
    const requestData = await req.json() 
    console.log(requestData.name)
    return Response.json({"Olá":"Mundo!"})
}
