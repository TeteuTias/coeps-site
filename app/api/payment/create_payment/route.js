import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
//
//
//
//
//
export const POST = withApiAuthRequired(async function POST(request) {
    try {
        // Verificando se o usuário está logado
        const { user } = await getSession(request, response);
        const _id = new ObjectId(user.sub.replace("auth0|", "")); // Retirando o auth0|
        
        // Puxando id_api
        const { db } = await connectToDatabase();
        const collection = 'usuarios';
        const query = { _id };

        const userDocument = await db.collection(collection).findOne(query, { projection: { "_id": 0, "id_api": 1 } });

        if (!userDocument) {
            return response.status(404).json({ "erro": "Usuário não encontrado" });
        }

        const id_api = userDocument.id_api;

        // Tentando Criar Pagamento Checkout
        const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY;
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
        const ASAAS_API_URL = process.env.ASAAS_API_URL + "/payments";
        const urlCallback = process.env.ASAAS_URL_CALLBACK;
        const redirect_url = process.env.ASAAS_URL_REDIRECT;

        const valor = 135;
        const data_vencimento = new Date().toISOString().split("T")[0]; // Retorna o dia de hoje
        const descricao = 'Primeiro lote para entrada no evento IV COEPS.';
        const desconto = 0;

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                billingType: 'UNDEFINED',
                discount: { value: desconto },
                callback: { successUrl: urlCallback, autoRedirect: false },
                customer: id_api,
                value: valor,
                dueDate: data_vencimento,
                postalService: false,
                description: descricao,
            })
        };

        const responseAPI = await fetch(ASAAS_API_URL, options);
        if (!responseAPI.ok) {
            throw new Error("Erro ao registrar pagamento na API do ASAAS");
        }

        const responseJson = await responseAPI.json();

        // Registrando o pagamento no DB
        const dbUpdateOne = await db.collection(collection).updateOne(
            { _id },
            {
                "$push": { 'pagamento.lista_pagamentos': { ...responseJson, _webhook: [] } },
                "$set": { 'pagamento.situacao': 2 }
            }
        );

        if (dbUpdateOne.matchedCount === 0) {
            return response.status(404).json({ "erro": "Usuário não encontrado ao atualizar" });
        }

        if (dbUpdateOne.modifiedCount === 0) {
            return response.status(400).json({ "erro": "Nenhuma modificação realizada no documento do usuário" });
        }

        return response.status(200).json({ "link": responseJson.invoiceUrl });
    } catch (error) {
        console.error(error);
        return response.status(403).json({ "erro": error.message });
    }
});

//