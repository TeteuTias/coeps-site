import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb'
import { getSession } from '@auth0/nextjs-auth0';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { DateTime } from "luxon"
//
//
//
export const DELETE = withApiAuthRequired(async function (req) {
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
        const eventStatus = await db.collection(collection).find(
            { _id: eventId },
            {
                projection: {
                    "dateOpen": 1,
                    "isOpen": 1,
                    "timeline": 1
                }
            }
        ).toArray()

        if (eventStatus.length == 0) {
            return Response.json({ message: 'Evento não encontrado' }, { status: 400 });
        }
        if (!eventStatus[0].isOpen) {
            return Response.json({ message: 'O evento não está mais aberto, por isso não é mais possível retirar sua inscrição.' }, { status: 400 });
        }
        if (!isDateEqualOrAfterToday(eventStatus[0].dateOpen)) {
            return Response.json({ message: 'O evento não está mais aberto, por isso não é mais possível retirar sua inscrição.' }, { status: 400 });
        }


        // Atualiza o evento adicionando o usuário à lista de participantes

        const updateResult = await db.collection(collection).findOneAndUpdate(
            { _id: eventId },
            { $pull: { participants: userId } },
            { returnDocument: 'after' }
          )

        // console.log(updateResult)
        // return Response.json({ message: 'teste' }, { status: 200 });


        if (updateResult) {
            //console.log(updateResult)
            switch (true) {
                case updateResult.participants.includes(userId):
                    return Response.json({ message: 'Não foi possível retirar sua inscrição. Regarregue a página e tente novamente.' }, { status: 403 });
            }


            return Response.json({ message: 'Sua inscrição foi retirada com sucesso!' }, { status: 200 });

        }
        return Response.json({ message: 'Não foi possível retirar sua inscrição. Regarregue a página e tente novamente.' }, { status: 403 });
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