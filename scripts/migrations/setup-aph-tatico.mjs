// Cria as 6 atividades do Minicurso APH Tático em `minicursos` (pacote prática + teórica + simulação).
// Sem --apply: só imprime o plano, sem conectar. Com --apply --backup-confirmed: insere o que falta (idempotente por _id).
import { MongoClient, ObjectId } from 'mongodb';

const databaseName = 'coeps2026';

// ===== Revisar antes de aplicar =====
const SEXTA = 'PREENCHER-AAAA-MM-DD'; // dia da teórica
const SABADO = 'PREENCHER-AAAA-MM-DD'; // dia da prática e da simulação
const DATE_OPEN = 'PREENCHER-AAAA-MM-DDTHH:mm:ss'; // quando a inscrição abre (horário de Brasília)
const IS_OPEN = false; // deixe false até liberar as inscrições
const VALOR_PRATICA = 55;
const LOCAL_TEORICA = 'PREENCHER';
const LOCAL_PRATICA = 'PREENCHER';
const LOCAL_SIMULACAO = 'Bosque';
const PRATICA_T1 = ['08:00', '12:00'];
const PRATICA_T2 = ['14:00', '18:00'];
const SIMULACAO_T1 = ['20:30', '21:30'];
const SIMULACAO_T2 = ['21:30', '22:30'];
// ====================================

const ids = {
    teoricaAvulsa: new ObjectId('6aefb6c221eec221c22ca978'),
    teoricaPacote: new ObjectId('6aefb6c221eec221c22ca979'),
    praticaT1: new ObjectId('6aefb6c221eec221c22ca97a'),
    praticaT2: new ObjectId('6aefb6c221eec221c22ca97b'),
    simulacaoT1: new ObjectId('6aefb6c221eec221c22ca97c'),
    simulacaoT2: new ObjectId('6aefb6c221eec221c22ca97d'),
};

const AVISO_PRATICA = 'Este é um evento composto por 3 etapas: teórica, prática e simulação. Ao se inscrever, você se compromete a participar das 3, e o certificado do pacote completo só será emitido para quem concluir todas.\n\nTurma 1 (prática às 08:00) faz a simulação às 20:30. Turma 2 (prática às 14:00) faz a simulação às 21:30.';
const AVISO_TEORICA = 'Esta inscrição é apenas para a etapa teórica e dá direito somente ao certificado da teórica. Para o curso completo (teórica, prática e simulação), inscreva-se na prática.';

const iso = (day, time) => `${day}T${time}:00-03:00`;
const activity = ({ _id, name, description, max, isFree, value = 0, day, time, local, extra = {} }) => ({
    _id,
    showToUser: true,
    name,
    description,
    maxParticipants: max,
    participantsCount: 0,
    participants: [],
    isFree,
    value,
    timeline: [{
        _id: new ObjectId(),
        name,
        date_init: iso(day, time[0]),
        date_end: iso(day, time[1]),
        description: '',
        speakers: [],
        presence_list: [],
        local_description: '',
        local,
        _idPattern: _id,
    }],
    isOpen: IS_OPEN,
    dateOpen: DATE_OPEN,
    type: 'minicurso',
    organization_name: 'CIEPS',
    emoji: '🚑',
    attendanceList: [],
    ...extra,
});

const docs = [
    activity({ _id: ids.teoricaAvulsa, name: 'APH Tático - Teórica', max: 80, isFree: true, day: SEXTA, time: ['07:00', '11:00'], local: LOCAL_TEORICA,
        description: 'Etapa teórica do Minicurso APH Tático. Inscrição avulsa: certificado somente da etapa teórica.',
        extra: { aviso: AVISO_TEORICA } }),
    activity({ _id: ids.teoricaPacote, name: 'APH Tático - Teórica', max: 40, isFree: true, day: SEXTA, time: ['07:00', '11:00'], local: LOCAL_TEORICA,
        description: 'Etapa teórica do Minicurso APH Tático (incluída na inscrição da prática).',
        extra: { somenteViaPacote: true } }),
    activity({ _id: ids.praticaT1, name: 'APH Tático - Prática (Turma 1)', max: 20, isFree: false, value: VALOR_PRATICA, day: SABADO, time: PRATICA_T1, local: LOCAL_PRATICA,
        description: 'Inclui a teórica (sexta, 07:00) e a simulação no bosque às 20:30.',
        extra: { aviso: AVISO_PRATICA, incluiAtividades: [String(ids.teoricaPacote), String(ids.simulacaoT1)] } }),
    activity({ _id: ids.praticaT2, name: 'APH Tático - Prática (Turma 2)', max: 20, isFree: false, value: VALOR_PRATICA, day: SABADO, time: PRATICA_T2, local: LOCAL_PRATICA,
        description: 'Inclui a teórica (sexta, 07:00) e a simulação no bosque às 21:30.',
        extra: { aviso: AVISO_PRATICA, incluiAtividades: [String(ids.teoricaPacote), String(ids.simulacaoT2)] } }),
    activity({ _id: ids.simulacaoT1, name: 'APH Tático - Simulação (Turma 1)', max: 20, isFree: true, day: SABADO, time: SIMULACAO_T1, local: LOCAL_SIMULACAO,
        description: 'Simulação no bosque da Turma 1 (incluída na inscrição da prática).',
        extra: { somenteViaPacote: true } }),
    activity({ _id: ids.simulacaoT2, name: 'APH Tático - Simulação (Turma 2)', max: 20, isFree: true, day: SABADO, time: SIMULACAO_T2, local: LOCAL_SIMULACAO,
        description: 'Simulação no bosque da Turma 2 (incluída na inscrição da prática).',
        extra: { somenteViaPacote: true } }),
];

// Coerência do pacote: vagas das incluídas cobrem as vagas das práticas.
const byId = new Map(docs.map(doc => [String(doc._id), doc]));
for (const pratica of docs.filter(doc => doc.incluiAtividades)) {
    for (const id of pratica.incluiAtividades) {
        const included = byId.get(id);
        if (!included?.somenteViaPacote) throw new Error(`Incluída inválida em ${pratica.name}: ${id}`);
    }
}
const pacoteSeats = docs.filter(doc => doc.incluiAtividades).reduce((sum, doc) => sum + doc.maxParticipants, 0);
if (byId.get(String(ids.teoricaPacote)).maxParticipants !== pacoteSeats) throw new Error('Vagas da teórica-pacote ≠ soma das práticas.');

const placeholders = JSON.stringify(docs).includes('PREENCHER');

if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({
        mode: 'plan-only', connectionOpened: false, databaseName, collection: 'minicursos',
        change: 'Inserir as 6 atividades do APH Tático que ainda não existem (por _id).',
        pendingPlaceholders: placeholders, docs,
    }, null, 2));
    process.exit(0);
}
if (placeholders) throw new Error('Preencha as constantes PREENCHER antes de aplicar.');
if (!process.argv.includes('--backup-confirmed')) throw new Error('A aplicação exige --backup-confirmed.');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');

const client = new MongoClient(process.env.MONGODB_URI, { readPreference: 'primary' });
try {
    await client.connect();
    const collection = client.db(databaseName).collection('minicursos');
    const existing = await collection.find({ _id: { $in: Object.values(ids) } }, { projection: { _id: 1 } }).toArray();
    const existingIds = new Set(existing.map(doc => String(doc._id)));
    const missing = docs.filter(doc => !existingIds.has(String(doc._id)));
    if (missing.length > 0) await collection.insertMany(missing);
    console.log(JSON.stringify({ status: 'applied', databaseName, collection: 'minicursos',
        inserted: missing.map(doc => String(doc._id)), alreadyPresent: [...existingIds] }));
} finally {
    await client.close();
}
