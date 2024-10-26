import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const maxPoolSizeValue = process.env.maxPoolSizeValue
if (!uri) {
  throw new Error('Please add your Mongo URI to .env.local');
}

if (!dbName) {
  throw new Error('Please add your MongoDB database name to .env.local');
}

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 1000, // Configuração inicial do pool de conexões
    readPreference: 'primary' // Força a leitura da primária
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
