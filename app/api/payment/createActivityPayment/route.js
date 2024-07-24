import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';
import { getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
import { DateTime } from "luxon"
//
//
//
//
//
export const POST = withApiAuthRequired(async function POST(request) {
    try {
        // Verificando se ele está logado
        // 
        const { user } = await getSession();
        const _id = user.sub.replace("auth0|", "") // Retirando o auth0|  
        const { eventId } = await request.json()
        //
        //
        const { db } = await connectToDatabase()
        const collection = 'minicursos'
        // Verifica se o usuário tem 4 ou menos inscrições
        const userRegistrationsCount = await db.collection(collection).find(
            {
                participants: new ObjectId(_id)
            },
            { projection: { timeline: 1, _id: [] } }
        ).toArray();
        if (userRegistrationsCount.length >= 3) {
            return Response.json({ message: 'Você já se inscreveu em 3 eventos.' }, { status: 400 });
        }

        const eventStatus = await db.collection(collection).find(
            { _id: new ObjectId(eventId) },
            {
                projection: {
                    "name": 1,
                    "dateOpen": 1,
                    "isOpen": 1,
                    "timeline": 1,
                    "value": 1,
                    "isFree": 1,
                    "participants":1
                }
            }
        ).toArray()
        if (eventStatus[0].participants.includes(_id)) {
            return Response.json({ message: 'Você já está inscrito nesse evento.' }, { status: 402 });
        }
        if (eventStatus[0].isFree == 1) {
            return Response.json({ message: 'Você não precisa pagar por esse evento. Por favor, recarregue a página para atualizar os eventos.' }, { status: 500 });
        }
        if (eventStatus.length == 0) {
            return Response.json({ message: 'Evento não encontrado. Por favor, recarregue a página' }, { status: 500 });
        }
        if (!eventStatus[0].isOpen) {
            return Response.json({ message: 'Não é mais possível se inscrever no evento' }, { status: 400 });
        }
        if (!isDateEqualOrAfterToday(eventStatus[0].dateOpen)) {
            return Response.json({ message: 'Não é mais possível se inscrever no evento' }, { status: 400 });
        }


        const timeConflict = isScheduleConflict(userRegistrationsCount, eventStatus[0])
        if (timeConflict) {
            return Response.json({ message: 'Não foi possível se inscrever no evento, pois você já possui outro evento que ocorrerá no mesmo dia/horário.' }, { status: 400 });
        }

        const updateResult = await db.collection("minicursos").findOneAndUpdate(
            {
                _id: new ObjectId(eventId),
                participants: { $ne: _id }, // Verifica se o usuário não está na lista
                isFree: 0 // Adiciona a condição de que isFree deve ser igual a 0
            },
            [
                {
                    $set: {
                        participantsCount: {
                            $cond: {
                                if: { $lt: [{ $size: "$participants" }, "$maxParticipants"] },
                                then: { $add: ["$participantsCount", 1] },
                                else: "$participantsCount"
                            }
                        },
                        participants: {
                            $cond: {
                                if: {
                                    $and: [
                                        { $lt: [{ $size: "$participants" }, "$maxParticipants"] },
                                        { $not: { $in: [_id, "$participants"] } }
                                    ]
                                },
                                then: { $concatArrays: ["$participants", [_id]] },
                                else: "$participants"
                            }
                        }
                    }
                }
            ],
            { returnDocument: "after" } // Para retornar o documento atualizado
        );

        //console.log(updateResult)
        if (updateResult) {
            //console.log(updateResult)
            switch (true) {
                case updateResult.maxParticipants == 0:
                    return Response.json({ message: 'Infelizmente, as vagas se esgotaram.' }, { status: 403 });
                case !updateResult.participants.includes(_id):
                    return Response.json({ message: 'Infelizmente, as vagas se esgotaram.' }, { status: 403 });
                /*
            case updateResult.participants.includes(_id):
                return Response.json({ message: 'Parabens! Você foi inscrito no evento!' }, { status: 200 });
                */
            }
            // return Response.json({ message: 'AQUI!' }, { status: 200 });

        }



        // Formata a data no formato ANO/mês/dia
        const brasiliaTime = DateTime.now().setZone('America/Sao_Paulo');
        const formattedDate = brasiliaTime.toFormat('yyyy/MM/dd');

        // Tentando Criar Pagamento Checkout.
        const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY;
        //const horario_limite = new Date(new Date().getTime()+ 10 * 60 * 1000) // 2023-08-14T19:09:10-03:00

        const ASAAS_API_KEY = process.env.ASAAS_API_KEY //process.env.ASAAS_API_KEY
        const ASAAS_API_URL = process.env.ASAAS_API_URL + "/payments"
        const urlCallback = process.env.ASAAS_URL_CALLBACK
        const redirect_url = process.env.ASAAS_URL_REDIRECT


        const valor = eventStatus[0].value
        const data_vencimento = formattedDate.replaceAll("/","-")
        console.log(data_vencimento)
        const descricao = "Pagamento ATIVIDADES - COEPS."
        const desconto = 0

        // Puxando id API
        const userInfos = await db.collection("usuarios").find(
            { _id: new ObjectId(_id) },
            {
                projection: {
                    _id: 0,
                    id_api: 1
                }
            }
        ).toArray()
        console.log(userInfos)
        if (userInfos.length == 0) {
            return Response.json({ message: 'Ocorreu algum erro, por favor recarregue a página! [userInfos.length == 0]' }, { status: 500 });
        }
        if (!userInfos[0].id_api) {
            return Response.json({ message: 'Ocorreu algum erro, por favor recarregue a página! [!userInfos[0].id_api]' }, { status: 500 });
        }


        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                billingType: 'PIX',
                discount: { value: desconto },
                callback: { successUrl: urlCallback, autoRedirect: false },
                customer: userInfos[0].id_api,
                value: valor,
                dueDate: data_vencimento,
                postalService: false,
                description: descricao,
            })
        };


        const responseAPI = await fetch(ASAAS_API_URL, options)

        if (!responseAPI.ok) {
            return Response.json({ message: 'Ocorreu algum erro, por favor recarregue a página. [!responseAPI.ok => Registro API Pagamentos]' }, { status: 500 });

        }


        var responseJson = await responseAPI.json()
        // 
        // Registrando o pagamento no DB
        const dbUpdateOne = await db.collection('usuarios').updateOne(
            {
                '_id': new ObjectId(_id)
            },
            {
                "$push": { 'pagamento.lista_pagamentos': { ...responseJson, _webhook: [], _type: "activity", _userId:_id, _eventID:eventId } },
            }
        )


        if (dbUpdateOne.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
            console.log("result.matchedCount === 0")
            return Response.json({ "message": "Ocorreu algum erro, por favor, recarregue a página. [result.matchedCount - dbUpdateOne]" }, { status: 500 })
        }
        else if (dbUpdateOne.modifiedCount === 0) { // Nenhum documento foi modificado.
            console.log("[result.modifiedCount === 0]")
            return Response.json({ "erro": "Ocorreu algum erro, por favor, recarregue a página. [result.modifiedCount === 0 - dbUpdateOne]" }, { status: 500 })
        }

        return Response.json({ message: 'Você completou sua inscrição! Para garantir sua vaga, é essencial que o pagamento seja realizado até o final do dia. Caso contrário, sua vaga será perdida.Para efetuar o pagamento, clique no botão abaixo ou acesse o menu MEUS PAGAMENTOS.', "link": responseJson.invoiceUrl }, { status: 200 });
    }
    catch (error) {
        console.log(error)
        return Response.json({ "message": error.message || "O CORREU ALGUM ERRO DESCONHECIDO" }, { status: 500 })
    }
})
//
const isScheduleConflict = (existingEvents, newEvent) => {
    for (const event of existingEvents) {
        for (const existingTimeline of event.timeline) {
            const existingStart = DateTime.fromISO(existingTimeline.date_init);
            const existingEnd = DateTime.fromISO(existingTimeline.date_end);

            for (const newTimeline of newEvent.timeline) {
                const newStart = DateTime.fromISO(newTimeline.date_init);
                const newEnd = DateTime.fromISO(newTimeline.date_end);

                if (
                    (newStart >= existingStart && newStart < existingEnd) ||
                    (newEnd > existingStart && newEnd <= existingEnd) ||
                    (newStart <= existingStart && newEnd >= existingEnd)
                ) {
                    return 1; // Horário conflitante
                }
            }
        }
    }
    return 0; // Nenhum conflito encontrado
}
//
const isDateEqualOrAfterToday = (inputDate) => {
    // Define a data atual no fuso horário -03:00 (America/Sao_Paulo)
    const currentDate = DateTime.now().setZone('America/Sao_Paulo');

    // Converte a string de data fornecida para um objeto DateTime no mesmo fuso horário
    const inputDateTime = DateTime.fromISO(inputDate, { zone: 'America/Sao_Paulo' });

    // Compara as duas datas
    if (currentDate >= inputDateTime) {
        return 1
    }
    return 0
}
//