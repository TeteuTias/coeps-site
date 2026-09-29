import { MongoClient, ObjectId } from 'mongodb';

const databaseName = 'coeps2026';
const configId = new ObjectId('6696813480751a9a3002bd8c');
const previousDeadline = '2026-10-05T23:59:59-03:00';
const extendedDeadline = '2026-10-12T23:59:59-03:00';

if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({
        mode: 'plan-only', connectionOpened: false, databaseName,
        collection: 'trabalhos_config', configId: String(configId),
        change: { data_limite_submissao: { from: previousDeadline, to: extendedDeadline } },
    }, null, 2));
    process.exit(0);
}
if (!process.argv.includes('--backup-confirmed')) {
    throw new Error('A aplicação exige --backup-confirmed.');
}
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');

const client = new MongoClient(process.env.MONGODB_URI, { readPreference: 'primary' });
try {
    await client.connect();
    const collection = client.db(databaseName).collection('trabalhos_config');
    const config = await collection.findOne(
        { _id: configId },
        { projection: { isOpen: 1, data_limite_submissao: 1 } },
    );
    if (!config || config.isOpen !== true) {
        throw new Error('Configuração aberta de submissão não encontrada.');
    }
    if (config.data_limite_submissao === extendedDeadline) {
        console.log(JSON.stringify({ status: 'already-applied', deadline: extendedDeadline }));
    } else {
        if (config.data_limite_submissao !== previousDeadline) {
            throw new Error('Prazo atual inesperado; nenhuma alteração aplicada.');
        }
        const result = await collection.updateOne(
            { _id: configId, isOpen: true, data_limite_submissao: previousDeadline },
            { $set: { data_limite_submissao: extendedDeadline } },
        );
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
            throw new Error('O prazo mudou durante a atualização; verifique a configuração.');
        }
        const after = await collection.findOne(
            { _id: configId },
            { projection: { data_limite_submissao: 1 } },
        );
        if (after?.data_limite_submissao !== extendedDeadline) {
            throw new Error('Verificação do novo prazo falhou.');
        }
        console.log(JSON.stringify({
            status: 'applied', databaseName, collection: 'trabalhos_config',
            configId: String(configId), before: previousDeadline, after: extendedDeadline,
        }));
    }
} finally {
    await client.close();
}
