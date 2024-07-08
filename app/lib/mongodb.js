// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

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
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 100, // Configuração inicial do pool de conexões AQUI EU CONFIGURO ATÉ QUANTAS CONEXÕES ELE VAI CRIAR
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
// Aparentemente daqui a pouco vou ter que remover essa bomba
//(node:14372) [MONGODB DRIVER] Warning: useNewUrlParser is a deprecated option: useNewUrlParser has no effect since Node.js Driver version 4.0.0 and will be removed in the next major version
//(node:14372) [MONGODB DRIVER] Warning: useUnifiedTopology is a deprecated option: useUnifiedTopology has no effect since Node.js Driver version 4.0.0 and will be removed in the next major version

