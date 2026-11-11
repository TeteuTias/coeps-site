import { DateTime } from 'luxon';

// Dois horários só conflitam quando realmente se sobrepõem.
// Encostados (um termina às 20:30 e o outro começa às 20:30) não conflitam.
export function hasScheduleConflict(existingEvents, newEvent) {
    for (const event of existingEvents || []) {
        for (const existingTimeline of event?.timeline || []) {
            const existingStart = DateTime.fromISO(existingTimeline.date_init);
            const existingEnd = DateTime.fromISO(existingTimeline.date_end);

            for (const newTimeline of newEvent?.timeline || []) {
                const newStart = DateTime.fromISO(newTimeline.date_init);
                const newEnd = DateTime.fromISO(newTimeline.date_end);

                if (newStart < existingEnd && newEnd > existingStart) {
                    return 1; // Horário conflitante
                }
            }
        }
    }
    return 0; // Nenhum conflito encontrado
}
