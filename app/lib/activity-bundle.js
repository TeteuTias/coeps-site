import { ObjectId } from 'mongodb';

// Pacote de atividades: quem entra numa atividade com `incluiAtividades`
// (ex.: prática APH) entra também nas etapas incluídas (teórica e simulação).
export function includedActivityIds(activity) {
    return (activity?.incluiAtividades ?? [])
        .filter((id) => ObjectId.isValid(String(id)))
        .map((id) => new ObjectId(String(id)));
}

/** action: 'add' | 'remove'. A vaga da atividade principal já limita as incluídas. */
export async function syncIncludedActivities(db, activityId, userId, action, session) {
    const activity = await db.collection('minicursos').findOne(
        { _id: new ObjectId(String(activityId)) },
        { projection: { incluiAtividades: 1 }, session },
    );
    const ids = includedActivityIds(activity);
    if (ids.length === 0) return 0;
    const operator = action === 'add' ? '$addToSet' : '$pull';
    const result = await db.collection('minicursos').updateMany(
        { _id: { $in: ids } },
        { [operator]: { participants: userId } },
        { session },
    );
    return result.modifiedCount;
}
