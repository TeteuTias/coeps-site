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
        //
        const dataPayment = await request.json()
        if (!dataPayment.typePayment) {
            throw new Error("TypePayment not defined.")
        }
        // Verificando se ele está logado
        // 
        const { user } = await getSession();
        const _id = new ObjectId(user.sub.replace("auth0|", "")) // Retirando o auth0|  
        const userId = user.sub.replace("auth0|", "") // sem estar em objectId
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
        //
        const colecao = "ingressos_config"
        const resultPagamento = await db.collection(colecao).find(
            { _id: new ObjectId("66bcfceedc9c7250e85b2ac6") },
        ).toArray()


        if (!resultPagamento[0]?.pagamentosAceitos?.includes(dataPayment?.typePayment)) {
            throw new Error("Desculpe, esse método de pagamento não é aceito.")
        }

        //
        // Tentando Criar Pagamento Checkout.
        const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY;
        //const horario_limite = new Date(new Date().getTime()+ 10 * 60 * 1000) // 2023-08-14T19:09:10-03:00

        const ASAAS_API_KEY = process.env.ASAAS_API_KEY //process.env.ASAAS_API_KEY
        const ASAAS_API_URL = process.env.ASAAS_API_URL + "/payments"
        const urlCallback = process.env.ASAAS_URL_CALLBACK
        const redirect_url = process.env.ASAAS_URL_REDIRECT


        let valor = null
        if (dataPayment.typePayment === "PIX") {
            valor = resultPagamento[0].valorPix
        } else if (dataPayment.typePayment === "DEBIT_CARD") {
            valor = resultPagamento[0].valorDebito
        } else if (dataPayment.typePayment === "BOLETO") {
            valor = resultPagamento[0].valorBoleto
        } else if (dataPayment.typePayment === "CREDIT_CARD") {
            valor = resultPagamento[0].valorAVista
        }
        if (valor === null) {
            throw new Error("O valor de seu pagamento não foi encontrado.")
        }

        valor = resultPagamento[0].valorAVista
        const data_vencimento = new Date().toISOString().split("T")[0] // retorna o dia de hoje.
        const descricao = resultPagamento[0].nome// 'Primeiro lote para entrada no evento IV COEPS.'
        const desconto = 0

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                customer: id_api,
                name: resultPagamento[0].nome,
                billingType: dataPayment?.typePayment === "DEBIT_CARD" ? "UNDEFINED" : dataPayment?.typePayment,
                value: valor,
                dueDate: data_vencimento,
                description: descricao,
                dueDateLimitDays: 3,
                discount: { value: desconto },
                callback: { successUrl: urlCallback, autoRedirect: false },

                postalService: false,
            })
        };

        const responseAPI = await fetch(ASAAS_API_URL, options)
        if (!responseAPI.ok) {
            var responseJson = await responseAPI.json()
            console.log(responseJson)
            throw ({ "message": "!responseAPI.ok => Registro API Pagamentos" })
        }
        var responseJson = await responseAPI.json()
        // 
        // Registrando o pagamento no DB
        const dbUpdateOne = await db.collection(collection).updateOne(
            {
                _id
            },
            {
                "$push": { 'pagamento.lista_pagamentos': { ...responseJson, _webhook: [], _type: "ticket", _userId: userId } },
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

        return Response.json({ "link": responseJson.invoiceUrl }, { status: 200 })
    }
    catch (error) {

        return Response.json({ "message": error instanceof Error ? error.message : "Desculpe. Ocorreu um erro desconhecido. Recarregue a página e tente novamente." }, { status: 403 })
    }
})
//