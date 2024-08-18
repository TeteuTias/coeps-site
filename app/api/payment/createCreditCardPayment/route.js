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
        const forwardedFor = request.headers.get('x-forwarded-for');

        // Se houver mais de um IP na lista, pega o primeiro
        const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : request.socket.remoteAddress;

        // Verificando se ele está logado
        // 
        const { user } = await getSession();
        const _id = new ObjectId(user.sub.replace("auth0|", "")) // Retirando o auth0|  
        const userId = user.sub.replace("auth0|", "") // sem estar em objectId

        const requestData = await request.json()

        //
        // Puxando id_api.
        const { db } = await connectToDatabase()
        const collection = 'usuarios'
        var query = {
            _id
        }
        const dbFindOne = await db.collection(collection).find(query, { projection: { "_id": 0, "id_api": 1 } }).toArray()

        if (dbFindOne.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
            //console.log("result.matchedCount === 0 - dbFindOne")
            return Response.json({ "erro": "result.matchedCount" }, { status: 404 })
        }
        else if (dbFindOne.modifiedCount === 0) { // Nenhum documento foi modificado.
            //console.log("result.modifiedCount === 0 - dbFindOne")
            return Response.json({ "erro": "result.modifiedCount === 0" }, { status: 400 })
        }
        const id_api = dbFindOne[0].id_api

        // Verificando se o pagamento existe
        const dbPagamento = await db.collection("ingressos_config").find({ _id: new ObjectId(requestData._id) }).toArray()

        if (!dbPagamento.length) {
            return NextResponse({ "message": "Ocorreu algum erro. Recarregue a página e tente novamente [!id - ingressos_config]" }, { status: 500 })
        }

        const configs = dbPagamento[0]



        //
        // Tentando Criar Pagamento Checkout.
        const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY;
        //const horario_limite = new Date(new Date().getTime()+ 10 * 60 * 1000) // 2023-08-14T19:09:10-03:00

        const ASAAS_API_KEY = process.env.ASAAS_API_KEY //process.env.ASAAS_API_KEY
        const ASAAS_API_URL = process.env.ASAAS_API_URL + "/payments"
        const urlCallback = process.env.ASAAS_URL_CALLBACK
        const redirect_url = process.env.ASAAS_URL_REDIRECT


        const valor = 180
        const data_vencimento = new Date().toISOString().split("T")[0] // retorna o dia de hoje.
        const descricao = 'Primeiro lote para entrada no evento IV COEPS.'
        const desconto = 0


        const configFromDb = configs.parcelamentos.find(parcela => parcela.codigo === requestData.idPagamento); // Essa é a config que veio direto do DB. Usamos ela para fazer o pagamento.

        if (!configFromDb) {
            return NextResponse.json({ "message": "Ocorreu um erro interno. Por favor, recarregue a página e tente novamente. [!configFromDb]" }, { status: 500 })
        }

        /*
        console.log({
            "customer": id_api,
            "billingType": "CREDIT_CARD",
            "installmentCount": configFromDb.totalParcelas,
            "installmentValue": configFromDb.valorCadaParcela,
            "dueDate": data_vencimento,
            "creditCard": {
                "holderName": requestData.cardInfo.name,
                "number": requestData.cardInfo.number,
                "expiryMonth": requestData.cardInfo.expiry.split("/")[0],
                "expiryYear": 20+requestData.cardInfo.expiry.split("/")[1],
                "ccv": requestData.cardInfo.cvc
            },
            "creditCardHolderInfo": {
                "name": requestData.cardInfo.name,
                "email": requestData.personalInfo.email,
                "cpfCnpj": requestData.personalInfo.cpfCnpj,
                "postalCode": requestData.personalInfo.postalCode,
                "addressNumber": requestData.personalInfo.addressNumber,
                "addressComplement": null,
                "phone": requestData.personalInfo.phone
            },
            "remoteIp": ip
        })
        */
        // return Response.json({"message":"sdfasdasf"},{status:500})


        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                "customer": id_api,
                "billingType": "CREDIT_CARD",
                "installmentCount": configFromDb.totalParcelas,
                "installmentValue": configFromDb.valorCadaParcela,
                "dueDate": data_vencimento,
                "creditCard": {
                    "holderName": requestData.cardInfo.name,
                    "number": requestData.cardInfo.number,
                    "expiryMonth": requestData.cardInfo.expiry.split("/")[0],
                    "expiryYear": 20 + requestData.cardInfo.expiry.split("/")[1],
                    "ccv": requestData.cardInfo.cvc
                },
                "creditCardHolderInfo": {
                    "name": requestData.cardInfo.name,
                    "email": requestData.personalInfo.email,
                    "cpfCnpj": requestData.personalInfo.cpfCnpj,
                    "postalCode": requestData.personalInfo.postalCode,
                    "addressNumber": requestData.personalInfo.addressNumber,
                    "addressComplement": null,
                    "phone": requestData.personalInfo.phone
                },
                "remoteIp": ip
            })
        };

        const responseAPI = await fetch(ASAAS_API_URL, options)
        if (!responseAPI.ok) {
            var responseJson = await responseAPI.json()
            return Response.json({ "message": responseJson['errors'][0]['description'], "code": responseJson['errors'][0]['code'] }, { status: 500 })
        }
        var responseJson = await responseAPI.json()
        // 

        // Registrando o pagamento no DB
        const dbUpdateOne = await db.collection(collection).updateOne(
            {
                _id
            },
            {
                "$push": { 'pagamento.lista_pagamentos': { ...responseJson, "description": configs.nome, _webhook: [], _type: "ticket", _userId: userId } },
                "$set": { 'pagamento.situacao': 2 }
            }
        )

        if (dbUpdateOne.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
            console.log("result.matchedCount === 0")
            return Response.json({ "erro": "result.matchedCount - dbUpdateOne" }, { status: 404 })
        }
        else if (dbUpdateOne.modifiedCount === 0) { // Nenhum documento foi modificado.

            return Response.json({ "erro": "result.modifiedCount === 0 - dbUpdateOne" }, { status: 400 })
        }

        return Response.json({ "message": "Seu pagamento foi realizado com sucesso! Dentro de 03 dias úteis ele será confirmado e você tera acesso total ao site! Clique em recarregar para prosseguir." }, { status: 200 })
    }
    catch (error) {

        return Response.json({ "erro": error }, { status: 403 })
    }
})
//