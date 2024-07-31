import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb'
import { getSession } from '@auth0/nextjs-auth0';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { DateTime } from "luxon"
//
//
//
export const PUT = withApiAuthRequired(async function (req) {
    const { db } = await connectToDatabase();
    const { user } = await getSession();
    const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  
    //const eventId = new ObjectId(req.body.eventId);
    const collection = "minicursos"

    const a = await req.json()
    const eventId = new ObjectId(a.eventId)

    // console.log(a)
    // console.log(eventId)
    // console.log("userId: ", userId)

    try {
        // Verifica se o usuário tem 4 ou menos inscrições
        const userRegistrationsCount = await db.collection(collection).find(
            {
                participants: userId
            },
            { projection: { timeline: 1, _id: [] } }
        ).toArray();
        // console.log(userRegistrationsCount)

        /*
        if (userRegistrationsCount.length >= 3) {
            return Response.json({ message: 'Você já se inscreveu em 3 eventos.' }, { status: 400 });
        }
        */

        const eventStatus = await db.collection(collection).find(
            { _id: eventId },
            {
                projection: {
                    "dateOpen": 1,
                    "isOpen": 1,
                    "timeline": 1,
                    "participants": 1
                }
            }
        ).toArray()

        //console.log(eventStatus)
        if (eventStatus[0].participants.includes(userId)) {
            return Response.json({ message: 'Você já está inscrito nesse evento.' }, { status: 402 });
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

        // Atualiza o evento adicionando o usuário à lista de participantes

        const updateResult = await db.collection("minicursos").findOneAndUpdate(
            {
                _id: eventId,
                participants: { $ne: userId } // Verifica se o usuário não está na lista
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
                                        { $not: { $in: [userId, "$participants"] } }
                                    ]
                                },
                                then: { $concatArrays: ["$participants", [userId]] },
                                else: "$participants"
                            }
                        }
                    }
                }
            ],
            { returnDocument: "after" } // Para retornar o documento atualizado
        );
        // console.log(updateResult)
        if (updateResult) {
            //console.log(updateResult)
            switch (true) {
                case updateResult.maxParticipants == 0:
                    return Response.json({ message: 'Infelizmente, as vagas se esgotaram.' }, { status: 403 });
                case !updateResult.participants.includes(userId):
                    return Response.json({ message: 'Infelizmente, as vagas se esgotaram.' }, { status: 403 });
                case updateResult.participants.includes(userId):
                    return Response.json({ message: 'Parabens! Você foi inscrito no evento!' }, { status: 200 });
            }


            // return Response.json({ message: 'AQUI!' }, { status: 200 });

        }
        return Response.json({ message: 'Infelizmente, as vagas se esgotaram.' }, { status: 403 });
    } catch (error) {
        console.error(error);
        return Response.json({ message: 'Internal server error' }, { status: 500 });
    }

})

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