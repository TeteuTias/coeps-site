import { ObjectId } from 'mongodb';
import type { Db, Document, WithId } from 'mongodb';

type AuthenticatedIdentity = {
    sub: unknown;
    email?: unknown;
};

function isDuplicateKey(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
        'code' in error && error.code === 11000;
}

/** Provisiona somente contas ausentes, sem alterar perfil ou estado financeiro existente. */
export async function ensureAuthenticatedUser(
    db: Db,
    identity: AuthenticatedIdentity,
    now = new Date(),
): Promise<WithId<Document>> {
    const subject = typeof identity.sub === 'string'
        ? /^auth0\|([a-f\d]{24})$/i.exec(identity.sub)
        : null;
    if (!subject) throw new Error('Invalid authenticated user identifier.');

    const owner = new ObjectId(subject[1]);
    const users = db.collection('usuarios');
    const existing = await users.findOne({ _id: owner });
    if (existing) return existing;

    const email = typeof identity.email === 'string' ? identity.email.trim() : '';
    try {
        await users.updateOne(
            { _id: owner },
            {
                $setOnInsert: {
                    id_api: '',
                    isPos_registration: false,
                    informacoes_usuario: {
                        cpf: '',
                        numero_telefone: '',
                        nome: '',
                        email,
                        data_criacao: now,
                        titulo_honorario: '',
                    },
                    pagamento: {
                        _id: owner,
                        situacao: 0,
                        tipo_pagamento: '',
                        situacao_animacao: false,
                        lista_pagamentos: [],
                    },
                },
            },
            { upsert: true },
        );
    } catch (error) {
        // Outro escritor (login/cobrança) pode ter inserido o mesmo _id.
        if (!isDuplicateKey(error)) throw error;
    }

    const persisted = await users.findOne({ _id: owner });
    if (!persisted) throw new Error('Authenticated user record was not persisted.');
    return persisted;
}
