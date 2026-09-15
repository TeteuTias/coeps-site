import { MongoClient } from "mongodb"

const apply = process.argv.includes("--apply")
const backupConfirmed = process.argv.includes("--backup-confirmed")
const plan = {
  collections: [
    "trabalhos_acessos_remotos",
    "trabalhos_submission_locks",
    "pagamentos.sessoes",
    "pagamentos.atribuicoes",
    "Dados_do_trabalho",
    "trabalhos_config",
  ],
  effects: [
    "cria índices de unicidade por usuário/edição para acesso remoto e lock de submissão",
    "cria índices de consulta por tipo de produto e vínculo de trabalhos remotos",
    "define permite_participacao_remota=false em todas as modalidades e true somente em Trabalho Completo (Apresentação Oral)",
  ],
}

if (!apply) {
  console.log(JSON.stringify({
    mode: "plan-only",
    message: "Nenhuma conexão com Mongo foi aberta. Para aplicar, use --apply --backup-confirmed após aprovação explícita.",
    ...plan,
  }, null, 2))
  process.exit(0)
}

if (!backupConfirmed) {
  throw new Error("Antes de aplicar, confirme um backup recuperável com --backup-confirmed.")
}

const uri = process.env.MONGODB_URI
const databaseName = process.env.MONGODB_DB
const editionId = String(process.env.PAYMENT_EDITION_ID || process.env.COEPS_ACTIVE_EDITION_ID || "").trim().toUpperCase()
if (!uri || !databaseName || !editionId) {
  throw new Error("MONGODB_URI, MONGODB_DB e PAYMENT_EDITION_ID (ou COEPS_ACTIVE_EDITION_ID) são obrigatórios.")
}

const client = new MongoClient(uri, { readPreference: "primary" })
try {
  await client.connect()
  const db = client.db(databaseName)
  const target = "Trabalho Completo (Apresentação Oral)"
  const workConfig = await db.collection("trabalhos_config").findOne(
    {},
    { projection: { modalidades: 1 } },
  )
  const targetMatches = Array.isArray(workConfig?.modalidades)
    ? workConfig.modalidades.filter(modalidade => modalidade?.modalidade === target)
    : []
  if (!workConfig?._id || targetMatches.length !== 1) {
    throw new Error(`Era esperada exatamente uma modalidade "${target}"; nenhuma alteração foi aplicada.`)
  }

  await db.collection("trabalhos_acessos_remotos").createIndexes([
    { key: { userId: 1, editionId: 1 }, name: "remote_access_user_edition_unique", unique: true },
    { key: { status: 1, proofReviewStatus: 1, editionId: 1 }, name: "remote_access_review_queue" },
    { key: { purchaseId: 1 }, name: "remote_access_purchase", sparse: true },
  ])
  await db.collection("trabalhos_submission_locks").createIndex(
    { userId: 1, editionId: 1 },
    { name: "work_submission_lock_user_edition_unique", unique: true },
  )
  await db.collection("pagamentos.sessoes").createIndex(
    { type: 1, owner: 1, edicaoId: 1, status: 1 },
    { name: "payment_sessions_product_owner_edition_status" },
  )
  await db.collection("pagamentos.sessoes").createIndex(
    { activeKey: 1 },
    {
      name: "payment_session_active_owner_unique",
      unique: true,
      partialFilterExpression: { activeKey: { $type: "string" } },
    },
  )
  await db.collection("pagamentos.atribuicoes").createIndex(
    { type: 1, usuarioId: 1, edicaoId: 1, status: 1 },
    { name: "payment_assignments_product_user_edition_status" },
  )
  await db.collection("Dados_do_trabalho").createIndexes([
    { key: { remoteAccessId: 1, participationMode: 1 }, name: "remote_works_by_access" },
    { key: { userId: 1, editionId: 1, modalidadeId: 1 }, name: "work_submission_limits" },
  ])

  const configResult = await db.collection("trabalhos_config").updateOne(
    { _id: workConfig._id },
    [{
      $set: {
        modalidades: {
          $map: {
            input: { $ifNull: ["$modalidades", []] },
            as: "modalidade",
            in: {
              $mergeObjects: [
                "$$modalidade",
                { permite_participacao_remota: { $eq: ["$$modalidade.modalidade", target] } },
              ],
            },
          },
        },
        remoteParticipationEditionId: editionId,
        remoteParticipationUpdatedAt: "$$NOW",
      },
    }],
  )
  if (configResult.matchedCount !== 1) {
    throw new Error("A configuração de trabalhos não foi encontrada.")
  }

  console.log(JSON.stringify({ mode: "applied", databaseName, editionId, ...plan }, null, 2))
} finally {
  await client.close()
}
