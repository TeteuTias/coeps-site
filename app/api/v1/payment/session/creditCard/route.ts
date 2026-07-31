import { ObjectId } from 'mongodb';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/app/lib/mongodb';
import { getUserId } from '@/lib/getUserId';
import PaymentTicketProps from '@/lib/types/payments/paymentTicket.t';
//
//
//
function formatarData(data: Date): string {
    data.setDate(data.getDate());

    // 3. Montamos no formato exato que o Asaas exige: YYYY-MM-DD
    const ano = data.getFullYear();
    // O getMonth() começa no zero (Janeiro = 0), por isso o +1.
    // O padStart(2, '0') garante que o mês 5 vire "05"
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    const dueDateFormatado = `${ano}-${mes}-${dia}`;
    return dueDateFormatado
}
//
//
//
/**
 * @abstract Cria pagamentos apenas para cartão de crédito, utilizando a API do Asaas.
 * Antes de criar o pagamento, ele verifica se a sessão do usuário ainda é válida.
 */
export const POST = withApiAuthRequired(async function POST(request) {
    // Captando ip para pagamento
    const forwardedFor = request.headers.get('x-forwarded-for');
    // Se houver mais de um IP na lista, pega o primeiro
    const ip =
        forwardedFor?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1';

    //
    try {
        //
        const now = new Date();
        const dataPayment = await request.json()
        const userId = await getUserId(request)
        //
        // Verificando se a sessão ainda existe: Como o processo inicia aqui, iniciamos aqui para não ser injusto com o usuário.
        const { db } = await connectToDatabase();
        const paymentSession = await db.collection("pagamentos.sessoes").findOne({
            _id: new ObjectId(dataPayment.sessionId),
            owner: new ObjectId(userId),
            expiresAt: { $gt: new Date() } // Verificando se a sessão ainda é válida (não expirou)
        })
        if (!paymentSession) {
            return Response.json({ message: "Infelizmente o tempo para realizar o pagamento terminou. Você será redirecionado para a área de pagamentos para a criação de um novo pagamento." }, { status: 409 })
        }
        //
        //
        const user = await db.collection("usuarios").findOne({ _id: new ObjectId(userId) }, { projection: { "_id": 0, "id_api": 1 } })
        if (!user) {
            return Response.json({ "message": "Usuário não encontrado.", data: dataPayment }, { status: 404 })
        }
        //
        const sessaoAtiva: PaymentTicketProps | null = await db.collection('pagamentos.sessoes').findOne({
            owner: new ObjectId(userId),
            type: "ticket",
            expiresAt: { $gt: now } // O segredo está aqui: expiresAt maior que o momento atual
        });
        // Se a sessão não existe:
        if (!sessaoAtiva) {
            return Response.json({ message: "Configuração não encontrada" }, { status: 404 });
        }
        //
        //
        const ASAAS_API_URL = process.env.ASAAS_API_URL
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY
        const ASAAS_URL_CALLBACK = process.env.ASAAS_URL_CALLBACK
        const ASAAS_URL_REDIRECT = process.env.ASAAS_URL_REDIRECT
        //
        //
        //
        // Buscando o Id de pagamento
        // O Id do pagamento vuscado deve ser idêntico ao id pré-existente na sessão ativa
        // Automaticamente no próprio sistema, há apenas um código por pagamento.
        // Essa regra apenas não será verdadeira se o pagamento for criado diretamente no banco de dados
        // e o autor não trocar o código.


        const pagamentoSelecionado = sessaoAtiva.paymentConfig.precos.parcelamentos.find(
            (p) => p.codigo === dataPayment.idPagamento // <-- Sem chaves, retorna automaticamente
        );
        if (!pagamentoSelecionado) {
            return Response.json({ erro: "Pagamento não encontrado." }, { status: 404 });
        }
        //
        //
        //
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                "customer": user.id_api,
                "billingType": "CREDIT_CARD",
                "installmentCount": pagamentoSelecionado.totalParcelas,
                "installmentValue": pagamentoSelecionado.valorCadaParcela,
                "dueDate": formatarData(now),
                "creditCard": {
                    "holderName": dataPayment.personalInfo.name,
                    "number": dataPayment.cardInfo.number,
                    "expiryMonth": dataPayment.cardInfo.expiry.split("/")[0],
                    "expiryYear": dataPayment.cardInfo.expiry.split("/")[1],
                    "ccv": dataPayment.cardInfo.cvc
                },
                "creditCardHolderInfo": {
                    "name": dataPayment.personalInfo.name,
                    "email": dataPayment.personalInfo.email,
                    "cpfCnpj": dataPayment.personalInfo.cpfCnpj,
                    "postalCode": dataPayment.personalInfo.postalCode,
                    "addressNumber": dataPayment.personalInfo.addressNumber,
                    "addressComplement": "",
                    "phone": dataPayment.personalInfo.phone
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
        // Registrando o pagamento no DB;
        // Registrando o pagamento no banco de dados;
        const dbUpdateOne = await db.collection("usuarios").updateOne(
            {
                _id: new ObjectId(userId)
            },
            {
                "$push": { 'pagamento.lista_pagamentos': { ...responseJson, "description": dataPayment.personalInfo.name, _webhook: [], _type: "ticket", _userId: userId } },
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
        //
        //
        //
        return Response.json({ "message": "Seu pagamento foi realizado com sucesso! Dentro de 03 dias úteis ele será confirmado e você tera acesso total ao site! Clique em recarregar para prosseguir." }, { status: 200 })
    }
    catch (error) {

        return Response.json({ "message": error instanceof Error ? error.message : "Desculpe. Ocorreu um erro desconhecido. Recarregue a página e tente novamente." }, { status: 403 })
    }
})
//
/*
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
            console.log("PIX")
            valor = resultPagamento[0].valorPix
        } else if (dataPayment.typePayment === "DEBIT_CARD") {
            console.log("DEBIT_CARD")
            valor = resultPagamento[0].valorDebito
        } else if (dataPayment.typePayment === "BOLETO") {
            console.log("BOLETO")
            valor = resultPagamento[0].valorBoleto
        } else if (dataPayment.typePayment === "CREDIT_CARD") {
            console.log("CREDIT_CARD")
            valor = resultPagamento[0].valorAVista
        }
        if (valor === null) {
            throw new Error("O valor de seu pagamento não foi encontrado.")
        }

        // valor = resultPagamento[0].valorAVista => o safado do bug aqui

        const data_vencimento = new Date().toISOString().split("T")[0] // retorna o dia de hoje.
        const descricao = resultPagamento[0].nome// 'Primeiro lote para entrada no VIII CIEPS.'
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
*/
