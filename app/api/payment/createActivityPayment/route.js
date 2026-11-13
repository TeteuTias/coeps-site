import { ObjectId } from 'mongodb';
import { publicErrorResponse, withApiAuthRequired } from '@/lib/auth0-compat';
import { getSession } from '@/lib/auth0-compat';
import { connectToDatabase } from '@/app/lib/mongodb';
import { DateTime } from "luxon"
import { asaasRequestHeaders } from '@/lib/payments/asaas';
import { isPaymentSalesEnabled, paymentSalesPausedResponse } from '@/lib/payments/sales';
import { acquireRegistrationLock, includedActivityIds, syncIncludedActivities } from '@/lib/activity-bundle';
import { hasScheduleConflict } from '@/lib/schedule-conflict';
import { ACTIVITY_SEAT_HOLD_MINUTES, activityChargeState } from '@/lib/activity-charge-state';
import { ensureProfileCustomer } from '@/lib/payments/customer-profile-sync';
import { atorCongressista, origemDoPedido, registrarLog } from '@/lib/auditoria';
//
//
//
//
//
/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    if (!isPaymentSalesEnabled()) return paymentSalesPausedResponse();
    // Vaga reservada e cobrança ainda não criada: se falhar aqui, nada mais libera a vaga.
    let releaseSeat = async () => { }
    let releaseLock = async () => { }
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
        const unlock = await acquireRegistrationLock(db, _id)
        if (!unlock) {
            return Response.json({ message: 'Já existe uma inscrição sua sendo processada. Aguarde alguns segundos e tente novamente.' }, { status: 409 });
        }
        releaseLock = unlock

        // Verifica se o usuário tem 4 ou menos inscrições
        const userRegistrationsCount = await db.collection(collection).find(
            {
                participants: _id
            },
            { projection: { timeline: 1, _id: [] } }
        ).toArray();
        /*
        if (userRegistrationsCount.length >= 3) {
            return Response.json({ message: 'Você já se inscreveu em 3 eventos.' }, { status: 400 });
        }
        */
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
                    "participants": 1,
                    "incluiAtividades": 1,
                    "somenteViaPacote": 1
                }
            }
        ).toArray()
        if (eventStatus.length == 0) {
            return Response.json({ message: 'Evento não encontrado. Por favor, recarregue a página' }, { status: 404 });
        }
        if (eventStatus[0].participants.includes(_id)) {
            // Vaga já reservada. PIX dentro dos 15 minutos: devolve o mesmo. Reserva expirada e vaga ainda
            // não liberada: renova a reserva na mesma cobrança.
            const owner = ObjectId.isValid(_id)
                ? await db.collection('usuarios').findOne(
                    { _id: new ObjectId(_id) },
                    { projection: { 'pagamento.lista_pagamentos': 1 } },
                )
                : null
            const today = DateTime.now().setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd')
            const charge = activityChargeState(owner?.pagamento?.lista_pagamentos, String(eventId), new Date())
            if (charge?.state === 'pendente' && charge.link) {
                return Response.json({ message: 'Você já tem um PIX em aberto para esta atividade. Sua vaga só é confirmada após o pagamento.', link: charge.link, holdUntil: charge.holdUntil }, { status: 200 });
            }
            if (charge?.state === 'vencida' && charge.id) {
                if (!eventStatus[0].isOpen) {
                    return Response.json({ message: 'Não é mais possível se inscrever no evento' }, { status: 400 });
                }
                return await renewOverdueCharge(db, _id, charge, today, request, String(eventId))
            }
            return Response.json({ message: 'Você já está inscrito nesse evento.' }, { status: 402 });
        }
        if (eventStatus[0].isFree == 1) {
            return publicErrorResponse('Você não precisa pagar por esse evento. Por favor, recarregue a página para atualizar os eventos.');
        }
        if (!eventStatus[0].isOpen) {
            return Response.json({ message: 'Não é mais possível se inscrever no evento' }, { status: 400 });
        }
        if (!isDateEqualOrAfterToday(eventStatus[0].dateOpen)) {
            return Response.json({ message: 'As inscrições para este evento ainda não abriram. Confira a data de abertura na programação.' }, { status: 400 });
        }


        const timeConflict = isScheduleConflict(userRegistrationsCount, eventStatus[0])
        if (timeConflict) {
            return Response.json({ message: 'Não foi possível se inscrever no evento, pois você já possui outro evento que ocorrerá no mesmo dia/horário.' }, { status: 400 });
        }
        if (eventStatus[0].somenteViaPacote) {
            return Response.json({ message: 'Esta etapa já está incluída na inscrição da prática.' }, { status: 400 });
        }
        const includedEvents = await db.collection(collection).find(
            { _id: { $in: includedActivityIds(eventStatus[0]) } },
            { projection: { timeline: 1 } }
        ).toArray()
        if (includedEvents.some(event => isScheduleConflict(userRegistrationsCount, event))) {
            return Response.json({ message: 'Não foi possível se inscrever: você já está inscrito em uma etapa deste curso (por exemplo, a teórica avulsa) ou em outro evento no mesmo horário. Se estiver na teórica avulsa, retire essa inscrição antes de se inscrever na prática.' }, { status: 400 });
        }

        // Antes de reservar a vaga: quem entrou por cortesia ainda não tem Customer no Asaas.
        const customer = await ensureProfileCustomer({
            db,
            owner: new ObjectId(_id),
            userId: _id,
            apiUrl: process.env.ASAAS_API_URL,
            apiKey: process.env.ASAAS_API_KEY,
        })
        if (!customer.ok) {
            if (customer.reason === 'PROFILE_INCOMPLETE') {
                return Response.json({ message: 'Para gerar o PIX, seu cadastro precisa ter nome completo, CPF, CEP e número do endereço. Nenhuma vaga foi reservada. Se seus dados já estiverem completos, fale com a equipe CIEPS.' }, { status: 400 });
            }
            return publicErrorResponse('Não foi possível preparar seu cadastro de pagamento agora, e nenhuma vaga foi reservada. Tente novamente em alguns minutos; se continuar, fale com a equipe CIEPS.');
        }

        const updateResult = await db.collection("minicursos").findOneAndUpdate(
            {
                _id: new ObjectId(eventId),
                participants: { $ne: _id }, // Verifica se o usuário não está na lista
                isFree: false // Adiciona a condição de que isFree deve ser igual a 0
            },
            [
                {
                    $set: {
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
                },
                { $set: { participantsCount: { $size: "$participants" } } }
            ],
            { returnDocument: "after" } // Para retornar o documento atualizado
        );

        if (updateResult) {
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
            // Reserva as etapas incluídas junto com a vaga (o webhook reaplica na confirmação).
            await syncIncludedActivities(db, eventId, _id, 'add')
            releaseSeat = async () => {
                releaseSeat = async () => { }
                await db.collection(collection).updateOne({ _id: new ObjectId(eventId) }, { $pull: { participants: _id } })
                await syncIncludedActivities(db, eventId, _id, 'remove')
            }
        }
        else {
            throw new Error('Ocorreu algum erro, por favor recarregue a página! [código de erro: updateResult]');
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
        const data_vencimento = formattedDate.replaceAll("/", "-")

        const descricao = "Pagamento ATIVIDADES - CIEPS."
        const desconto = 0


        const options = {
            method: 'POST',
            headers: asaasRequestHeaders(ASAAS_API_KEY, {
                json: true,
                apiUrl: process.env.ASAAS_API_URL,
            }),
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({
                billingType: 'PIX',
                discount: { value: desconto },
                callback: { successUrl: urlCallback, autoRedirect: false },
                customer: customer.customerId,
                value: valor,
                dueDate: data_vencimento,
                postalService: false,
                description: descricao,
            })
        };


        const responseAPI = await fetch(ASAAS_API_URL, options)

        if (!responseAPI.ok) {
            await releaseSeat()
            return publicErrorResponse('Não foi possível gerar o PIX agora e sua vaga não foi reservada. Tente novamente em alguns minutos.');

        }


        // Cobrança criada no Asaas: a partir daqui o webhook cuida da vaga.
        releaseSeat = async () => { }
        var responseJson = await responseAPI.json()
        const reservedAt = new Date()
        // 
        // Registrando o pagamento no DB
        const dbUpdateOne = await db.collection('usuarios').updateOne(
            {
                '_id': new ObjectId(_id)
            },
            {
                "$push": { 'pagamento.lista_pagamentos': { ...responseJson, _webhook: [], _type: "activity", _userId: _id, _eventID: eventId, _reservedAt: reservedAt } },
            }
        )


        if (dbUpdateOne.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.

            return Response.json({ "message": "Ocorreu algum erro, por favor, recarregue a página. [result.matchedCount - dbUpdateOne]" }, { status: 500 })
        }
        else if (dbUpdateOne.modifiedCount === 0) { // Nenhum documento foi modificado.

            return Response.json({ "erro": "Ocorreu algum erro, por favor, recarregue a página. [result.modifiedCount === 0 - dbUpdateOne]" }, { status: 500 })
        }

        await registrarLog(db, {
            origem: 'site',
            acao: 'inscricao.reservar',
            categoria: 'inscricao',
            resumo: `Reservou vaga e gerou PIX (vaga guardada por ${ACTIVITY_SEAT_HOLD_MINUTES} min)`,
            ator: atorCongressista(_id),
            alvo: { usuarioId: _id, minicursoId: eventId, minicursoNome: eventStatus[0].name, cobrancaId: responseJson?.id },
            depois: { inscrito: true, cobranca: { id: responseJson?.id, status: responseJson?.status, value: responseJson?.value, dueDate: responseJson?.dueDate } },
            requisicao: origemDoPedido(request),
        })

        return Response.json({
            message: `Sua vaga está reservada por ${ACTIVITY_SEAT_HOLD_MINUTES} minutos. Pague o PIX nesse prazo para confirmar a inscrição; sem pagamento, a vaga é liberada. Para pagar, clique no botão abaixo ou acesse o menu MEUS PAGAMENTOS.`,
            "link": responseJson.invoiceUrl,
            holdUntil: new Date(reservedAt.getTime() + ACTIVITY_SEAT_HOLD_MINUTES * 60 * 1000).toISOString(),
        }, { status: 200 });
    }
    catch {
        await releaseSeat().catch(() => { })
        return publicErrorResponse("Não foi possível iniciar o pagamento da atividade.")
    }
    finally {
        await releaseLock().catch(() => { })
    }
})
//
// A reserva da vaga dura 15 minutos. Quem deixou passar e ainda não teve a vaga liberada (a liberação
// roda na reconciliação) pode reservar de novo: a mesma cobrança é reaberta, sem criar uma segunda.
// Se o vencimento do PIX já passou, o Asaas recebe a nova data.
async function renewOverdueCharge(db, userId, charge, today, request, eventId) {
    const set = { 'pagamento.lista_pagamentos.$[charge]._reservedAt': new Date() }
    let link = charge.link
    const pastDue = typeof charge.dueDate !== 'string' || charge.dueDate.slice(0, 10) < today
    if (pastDue) {
        const response = await fetch(`${process.env.ASAAS_API_URL}/payments/${encodeURIComponent(charge.id)}`, {
            method: 'PUT',
            headers: asaasRequestHeaders(process.env.ASAAS_API_KEY, {
                json: true,
                apiUrl: process.env.ASAAS_API_URL,
            }),
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ billingType: 'PIX', value: charge.value, dueDate: today }),
        })
        if (response.status === 404) {
            return Response.json({ message: RESERVA_LIBERADA }, { status: 409 });
        }
        if (!response.ok) {
            return publicErrorResponse('Não foi possível gerar um novo PIX agora. Tente novamente em alguns minutos; se continuar, fale com a equipe CIEPS.');
        }
        const updated = await response.json()
        link = updated?.invoiceUrl || charge.link
        set['pagamento.lista_pagamentos.$[charge].status'] = !updated?.status || updated.status === 'OVERDUE' ? 'PENDING' : updated.status
        set['pagamento.lista_pagamentos.$[charge].dueDate'] = updated?.dueDate || today
        set['pagamento.lista_pagamentos.$[charge].invoiceUrl'] = link
    }
    const renewed = await db.collection('usuarios').updateOne(
        { _id: new ObjectId(userId) },
        { $set: set },
        { arrayFilters: [{ 'charge.id': charge.id, 'charge._type': 'activity' }] },
    )
    if (renewed.modifiedCount === 0) {
        return Response.json({ message: RESERVA_LIBERADA }, { status: 409 });
    }
    await registrarLog(db, {
        origem: 'site',
        acao: 'inscricao.renovar_reserva',
        categoria: 'inscricao',
        resumo: `Renovou a reserva da vaga (mesma cobrança, mais ${ACTIVITY_SEAT_HOLD_MINUTES} min)`,
        ator: atorCongressista(userId),
        alvo: { usuarioId: userId, minicursoId: eventId, cobrancaId: charge.id },
        detalhes: { pixVencidoAtualizado: pastDue },
        requisicao: origemDoPedido(request),
    })
    return Response.json({
        message: `Sua vaga está reservada por mais ${ACTIVITY_SEAT_HOLD_MINUTES} minutos. Pague o PIX nesse prazo; sem pagamento, a vaga é liberada. Para pagar, clique no botão abaixo ou acesse o menu MEUS PAGAMENTOS.`,
        link,
        holdUntil: new Date(Date.now() + ACTIVITY_SEAT_HOLD_MINUTES * 60 * 1000).toISOString(),
    }, { status: 200 });
}
const RESERVA_LIBERADA = 'Sua reserva expirou e a vaga foi liberada. Recarregue a página para se inscrever de novo, se ainda houver vaga.'
//
const isScheduleConflict = hasScheduleConflict
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
