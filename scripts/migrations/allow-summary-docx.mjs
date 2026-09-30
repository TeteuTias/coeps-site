import { MongoClient, ObjectId } from 'mongodb';

const databaseName = 'coeps2026';
const configId = new ObjectId('6696813480751a9a3002bd8c');
const modalityId = new ObjectId('68a9b9921c3b2b27d4cc1fd2');
const modalityName = 'Trabalho Completo (Apresentação Oral)';
const requirementName = 'Resumo de trabalho';

if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({
        mode: 'plan-only', connectionOpened: false, databaseName,
        collection: 'trabalhos_config', configId: String(configId),
        change: 'Adicionar .docx ao requisito Resumo de trabalho; preservar .pdf.',
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
    const config = await collection.findOne({ _id: configId }, { projection: { modalidades: 1 } });
    const modalities = (config?.modalidades ?? []).filter(item =>
        String(item._id) === String(modalityId) && item.modalidade === modalityName);
    if (modalities.length !== 1) throw new Error('Modalidade alvo não encontrada exatamente uma vez.');
    const requirements = (modalities[0].requisitos_arquivos ?? []).filter(item => item.titulo === requirementName);
    if (requirements.length !== 1) throw new Error('Requisito alvo não encontrado exatamente uma vez.');
    const before = requirements[0].formatos;
    if (!Array.isArray(before) || !before.includes('.pdf')
        || before.some(value => !['.pdf', '.docx'].includes(value))) {
        throw new Error('Formatos inesperados; nenhuma alteração aplicada.');
    }
    if (before.includes('.docx')) {
        console.log(JSON.stringify({ status: 'already-applied', before }));
    } else {
        const result = await collection.updateOne(
            { _id: configId },
            { $addToSet: { 'modalidades.$[mod].requisitos_arquivos.$[req].formatos': '.docx' } },
            { arrayFilters: [
                { 'mod._id': modalityId, 'mod.modalidade': modalityName },
                { 'req.titulo': requirementName },
            ] },
        );
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
            throw new Error('A atualização não modificou exatamente um documento.');
        }
        const afterConfig = await collection.findOne({ _id: configId }, { projection: { modalidades: 1 } });
        const after = afterConfig.modalidades.find(item => String(item._id) === String(modalityId))
            .requisitos_arquivos.find(item => item.titulo === requirementName).formatos;
        if (!after.includes('.pdf') || !after.includes('.docx')) throw new Error('Verificação após a escrita falhou.');
        console.log(JSON.stringify({ status: 'applied', databaseName, collection: 'trabalhos_config',
            configId: String(configId), before, after }));
    }
} finally {
    await client.close();
}
