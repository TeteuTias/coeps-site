// Minicurso APH Tático em `minicursos`: pacote prática + teórica + simulação.
// Ajusta os 4 documentos que já existem em produção e cria os 2 que faltam:
//   TEORIA                → teórica avulsa: gratuita, 80 vagas, aviso de certificado só da teórica.
//   novo: teórica pacote  → cópia da TEORIA: 40 vagas, só via pacote.
//   TURMA 1 / TURMA 2     → prática R$ 55, 20 vagas, aviso, inclui a teórica do pacote e a simulação da turma.
//   Simulação             → Turma 1: 20:30–21:30, 20 vagas, só via pacote.
//   novo: simulação T2    → cópia da simulação: 21:30–22:30, 20 vagas, só via pacote.
// Rode só com o código do pacote já publicado: o código antigo ignora incluiAtividades/somenteViaPacote.
// Sem --apply: só imprime o plano, sem conectar.
// Com --apply --backup-confirmed: confere os 4 documentos (existem, sem inscritos, horário esperado),
// salva uma cópia deles em arquivo e aplica tudo numa transação. Rodar de novo não duplica nada.
import fs from 'node:fs';
import path from 'node:path';
import { BSON, MongoClient, ObjectId } from 'mongodb';

const databaseName = 'coeps2026';

// Documentos que já existem em produção (lidos em 2026-11-09) e o início esperado de cada um.
const existing = {
    teoria: { _id: new ObjectId('6af11c2071eb5ac72c5fad60'), inicio: '2026-11-13T07:00:00-03:00' },
    praticaT1: { _id: new ObjectId('6af1d3cf857c1e368ecd01d7'), inicio: '2026-11-14T08:00:00-03:00' },
    praticaT2: { _id: new ObjectId('6af1d45c857c1e368ecd0239'), inicio: '2026-11-14T14:00:00-03:00' },
    simulacaoT1: { _id: new ObjectId('6af1d4c5857c1e368ecd0283'), inicio: '2026-11-14T20:30:00-03:00' },
};
// Documentos novos, com _id fixo para o script não duplicar.
const created = {
    teoricaPacote: new ObjectId('6aefb6c221eec221c22ca979'),
    simulacaoT2: new ObjectId('6aefb6c221eec221c22ca97d'),
};

const VAGAS = { teoriaAvulsa: 80, teoriaPacote: 40, pratica: 20, simulacao: 20 };
const VALOR_PRATICA = 55;
const SIMULACAO_T1_FIM = '2026-11-14T21:30:00-03:00';
const SIMULACAO_T2 = { date_init: '2026-11-14T21:30:00-03:00', date_end: '2026-11-14T22:30:00-03:00' };
const nomeSimulacao = (turma) => `Simulação Prática APH Tático (Turma ${turma})`;

const AVISO_PRATICA = 'Este é um evento composto por 3 etapas: teórica, prática e simulação. Ao se inscrever, você se compromete a participar das 3, e o certificado do pacote completo só será emitido para quem concluir todas.\n\nTurma 1 (prática às 08:00) faz a simulação às 20:30. Turma 2 (prática às 14:00) faz a simulação às 21:30.';
const AVISO_TEORICA = 'Esta inscrição é apenas para a etapa teórica e dá direito somente ao certificado da teórica. Para o curso completo (teórica, prática e simulação), inscreva-se na prática.';
// Acrescentado ao fim da descrição das práticas (teórica do pacote e simulações não aparecem na lista).
const INCLUI = {
    praticaT1: 'Inclui a etapa teórica (sexta, 13/11, 07:00) e a simulação no bosque (sábado, 14/11, 20:30).',
    praticaT2: 'Inclui a etapa teórica (sexta, 13/11, 07:00) e a simulação no bosque (sábado, 14/11, 21:30).',
};

const changes = {
    teoria: { isFree: true, value: 0, maxParticipants: VAGAS.teoriaAvulsa, aviso: AVISO_TEORICA },
    praticaT1: { isFree: false, value: VALOR_PRATICA, maxParticipants: VAGAS.pratica, aviso: AVISO_PRATICA,
        incluiAtividades: [String(created.teoricaPacote), String(existing.simulacaoT1._id)] },
    praticaT2: { isFree: false, value: VALOR_PRATICA, maxParticipants: VAGAS.pratica, aviso: AVISO_PRATICA,
        incluiAtividades: [String(created.teoricaPacote), String(created.simulacaoT2)] },
    simulacaoT1: { name: nomeSimulacao(1), 'timeline.0.name': nomeSimulacao(1), 'timeline.0.date_end': SIMULACAO_T1_FIM,
        maxParticipants: VAGAS.simulacao, somenteViaPacote: true },
};

// Coerência do pacote: as práticas só incluem etapas "só via pacote", e as vagas delas cobrem as práticas.
const viaPacote = new Set([String(created.teoricaPacote), String(existing.simulacaoT1._id), String(created.simulacaoT2)]);
for (const key of ['praticaT1', 'praticaT2']) {
    if (!changes[key].incluiAtividades.every((id) => viaPacote.has(id))) throw new Error(`Incluída inválida em ${key}.`);
}
if (VAGAS.teoriaPacote !== 2 * VAGAS.pratica) throw new Error('Vagas da teórica do pacote ≠ soma das práticas.');
if (VAGAS.simulacao < VAGAS.pratica) throw new Error('Simulação com menos vagas que a prática da turma.');

const appendOnce = (text = '', suffix) => (text.includes(suffix) ? text : `${text.trimEnd()} ${suffix}`.trim());

// Cópia "só via pacote" de um documento: sem inscritos, listas de presença vazias e _id/_idPattern novos.
function viaPacoteCopy(source, _id, { name = source.name, maxParticipants, horario = {} }) {
    const { _id: _sourceId, aviso, incluiAtividades, ...rest } = source;
    return {
        ...rest,
        _id,
        name,
        isFree: true,
        value: 0,
        maxParticipants,
        participantsCount: 0,
        participants: [],
        attendanceList: [],
        somenteViaPacote: true,
        timeline: source.timeline.map((item) => ({
            ...item, ...horario, _id: new ObjectId(), name, presence_list: [], _idPattern: _id,
        })),
    };
}

if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({
        mode: 'plan-only', connectionOpened: false, databaseName, collection: 'minicursos',
        update: Object.fromEntries(Object.entries(changes).map(([key, set]) => [String(existing[key]._id), {
            $set: set, ...(INCLUI[key] ? { descricaoGanhaNoFim: INCLUI[key] } : {}),
        }])),
        insert: {
            [String(created.teoricaPacote)]: `cópia da TEORIA (${existing.teoria._id}), ${VAGAS.teoriaPacote} vagas, só via pacote`,
            [String(created.simulacaoT2)]: `cópia da simulação (${existing.simulacaoT1._id}), ${nomeSimulacao(2)}, ${SIMULACAO_T2.date_init} → ${SIMULACAO_T2.date_end}, ${VAGAS.simulacao} vagas, só via pacote`,
        },
    }, null, 2));
    process.exit(0);
}
if (!process.argv.includes('--backup-confirmed')) throw new Error('A aplicação exige --backup-confirmed.');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');

const client = new MongoClient(process.env.MONGODB_URI, { readPreference: 'primary' });
try {
    await client.connect();
    const collection = client.db(databaseName).collection('minicursos');

    const current = await collection.find({ _id: { $in: Object.values(existing).map((e) => e._id) } }).toArray();
    const doc = {};
    for (const [key, { _id, inicio }] of Object.entries(existing)) {
        const found = current.find((d) => d._id.equals(_id));
        if (!found) throw new Error(`${key} (${_id}) não existe: confira se o documento foi recriado com outro _id. Nada foi alterado.`);
        if (!Array.isArray(found.participants) || found.participants.length > 0) throw new Error(`${found.name} já tem inscritos. Nada foi alterado.`);
        if (found.timeline?.length !== 1 || found.timeline[0].date_init !== inicio) throw new Error(`${found.name}: horário diferente do esperado. Nada foi alterado.`);
        doc[key] = found;
    }
    const already = await collection.find({ _id: { $in: Object.values(created) } }).toArray();
    for (const d of already) {
        if (d.somenteViaPacote !== true) throw new Error(`O _id ${d._id} já existe e não foi criado por este script. Nada foi alterado.`);
    }

    const backupFile = path.resolve(`aph-tatico-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupFile, BSON.EJSON.stringify(current, null, 2, { relaxed: false }));
    console.log(JSON.stringify({ backup: backupFile, documentos: current.length }));

    const toInsert = [
        viaPacoteCopy(doc.teoria, created.teoricaPacote, { maxParticipants: VAGAS.teoriaPacote }),
        viaPacoteCopy(doc.simulacaoT1, created.simulacaoT2, { name: nomeSimulacao(2), maxParticipants: VAGAS.simulacao, horario: SIMULACAO_T2 }),
    ].filter((novo) => !already.some((d) => d._id.equals(novo._id)));

    const session = client.startSession();
    try {
        await session.withTransaction(async () => {
            for (const [key, set] of Object.entries(changes)) {
                const description = INCLUI[key] ? { description: appendOnce(doc[key].description, INCLUI[key]) } : {};
                const result = await collection.updateOne(
                    { _id: existing[key]._id, participants: { $size: 0 } },
                    { $set: { ...set, ...description } },
                    { session },
                );
                if (result.matchedCount !== 1) throw new Error(`${doc[key].name} mudou durante a aplicação. Nada foi alterado.`);
            }
            if (toInsert.length > 0) await collection.insertMany(toInsert, { session });
        });
    } finally {
        await session.endSession();
    }

    // Conferência do resultado gravado.
    const ids = [...Object.values(existing).map((e) => e._id), ...Object.values(created)];
    const after = await collection.find({ _id: { $in: ids } }).toArray();
    const get = (_id) => after.find((d) => d._id.equals(_id));
    const teoria = get(existing.teoria._id);
    const pacote = get(created.teoricaPacote);
    const turmas = [
        [get(existing.praticaT1._id), get(existing.simulacaoT1._id), SIMULACAO_T1_FIM],
        [get(existing.praticaT2._id), get(created.simulacaoT2), SIMULACAO_T2.date_end],
    ];
    const problems = [];
    if (!(teoria?.isFree === true && teoria.maxParticipants === VAGAS.teoriaAvulsa && teoria.aviso === AVISO_TEORICA && !teoria.somenteViaPacote)) problems.push('teórica avulsa');
    if (!(pacote?.somenteViaPacote === true && pacote.maxParticipants === VAGAS.teoriaPacote && pacote.timeline?.[0]?.date_init === teoria?.timeline?.[0]?.date_init)) problems.push('teórica do pacote');
    for (const [pratica, simulacao, fim] of turmas) {
        if (!(pratica?.isFree === false && pratica.value === VALOR_PRATICA && pratica.maxParticipants === VAGAS.pratica && pratica.aviso === AVISO_PRATICA
            && JSON.stringify(pratica.incluiAtividades) === JSON.stringify([String(created.teoricaPacote), String(simulacao?._id)]))) problems.push(`prática ${pratica?.name}`);
        if (!(simulacao?.somenteViaPacote === true && simulacao.maxParticipants === VAGAS.simulacao && simulacao.timeline?.[0]?.date_end === fim)) problems.push(`simulação ${simulacao?.name}`);
    }
    console.log(JSON.stringify({
        status: problems.length ? 'applied-with-problems' : 'applied', databaseName, collection: 'minicursos',
        inserted: toInsert.map((d) => String(d._id)), alreadyPresent: already.map((d) => String(d._id)), problems,
        resultado: after.map((d) => ({ _id: String(d._id), name: d.name, vagas: d.maxParticipants, isFree: d.isFree, value: d.value,
            somenteViaPacote: d.somenteViaPacote === true, inclui: d.incluiAtividades ?? [], horario: `${d.timeline?.[0]?.date_init} → ${d.timeline?.[0]?.date_end}` })),
    }, null, 2));
    if (problems.length) process.exitCode = 1;
} finally {
    await client.close();
}
