import { ObjectId } from 'mongodb';

// Pacote de atividades: quem entra numa atividade com `incluiAtividades`
// (ex.: prática APH) entra também nas etapas incluídas (teórica e simulação).
export function includedActivityIds(activity) {
    return (activity?.incluiAtividades ?? [])
        .filter((id) => ObjectId.isValid(String(id)))
        .map((id) => new ObjectId(String(id)));
}

// O Admin grava em minicursos.cancelamentosSemEstorno quem foi tirado sem estorno (aceitou perder o valor)
// e com quais cobranças. Pagamento ou confirmação posterior dessas cobranças não reinscreve a pessoa.
// Uma compra nova tem outra cobrança e entra normalmente.
export function notCancelledWithoutRefund(userId, chargeId) {
    return {
        cancelamentosSemEstorno: {
            $not: { $elemMatch: { userId: String(userId), cobrancas: String(chargeId) } },
        },
    };
}

/** action: 'add' | 'remove'. A vaga da atividade principal já limita as incluídas. */
export async function syncIncludedActivities(db, activityId, userId, action, session) {
    const activityObjectId = new ObjectId(String(activityId));
    const activity = await db.collection('minicursos').findOne(
        { _id: activityObjectId },
        { projection: { incluiAtividades: 1 }, session },
    );
    let ids = includedActivityIds(activity);
    if (action === 'remove' && ids.length > 0) {
        // Etapa compartilhada (ex.: teórica do pacote) fica com quem ainda está em outra turma do mesmo curso.
        const otherBundles = await db.collection('minicursos').find(
            { _id: { $ne: activityObjectId }, participants: userId, incluiAtividades: { $in: [...ids, ...ids.map(String)] } },
            { projection: { incluiAtividades: 1 }, session },
        ).toArray();
        const stillIncluded = new Set(otherBundles.flatMap((other) => includedActivityIds(other).map(String)));
        ids = ids.filter((id) => !stillIncluded.has(String(id)));
    }
    let modifiedCount = 0;
    if (ids.length > 0) {
        const operator = action === 'add' ? '$addToSet' : '$pull';
        const result = await db.collection('minicursos').updateMany(
            { _id: { $in: ids } },
            { [operator]: { participants: userId } },
            { session },
        );
        modifiedCount = result.modifiedCount;
    }
    // Quem chama acabou de alterar participants da atividade principal; recalcula ela e as incluídas.
    if (activity) await refreshParticipantsCount(db, [activityObjectId, ...ids], session);
    return modifiedCount;
}

// participantsCount sempre igual ao tamanho de participants (o admin exibe esse número).
export async function refreshParticipantsCount(db, activityIds, session) {
    const ids = activityIds.map((id) => new ObjectId(String(id)));
    if (ids.length === 0) return;
    await db.collection('minicursos').updateMany(
        { _id: { $in: ids } },
        [{ $set: { participantsCount: { $size: { $ifNull: ['$participants', []] } } } }],
        { session },
    );
}

const REGISTRATION_LOCK_COLLECTION = 'minicursos.travas';
const REGISTRATION_LOCK_MS = 30_000;

// Uma inscrição/compra de atividade por vez para cada usuário: as checagens de conflito
// leem as inscrições antes de gravar, então duas requisições em paralelo (ex.: Turma 1 e
// Turma 2) passariam juntas. Usa a unicidade do _id; a trava vence sozinha se o processo cair.
// Devolve a função que libera a trava, ou null se já houver outra inscrição em andamento.
export async function acquireRegistrationLock(db, userId) {
    const now = new Date();
    const token = new ObjectId();
    try {
        await db.collection(REGISTRATION_LOCK_COLLECTION).updateOne(
            { _id: String(userId), expiresAt: { $lte: now } },
            { $set: { token, expiresAt: new Date(now.getTime() + REGISTRATION_LOCK_MS) } },
            { upsert: true },
        );
    } catch (error) {
        if (error?.code === 11000) return null;
        throw error;
    }
    return async () => {
        await db.collection(REGISTRATION_LOCK_COLLECTION).deleteOne({ _id: String(userId), token });
    };
}
