import { MongoClient } from "mongodb"

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getDatabaseUrl() {
  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error("DATABASE_URL is not set")
  return uri
}

function getDbNameFromUri(uri: string) {
  try {
    const name = new URL(uri).pathname.replace(/^\//, "")
    return name || undefined
  } catch {
    return undefined
  }
}

function getClientPromise() {
  if (!globalThis._mongoClientPromise) {
    const uri = getDatabaseUrl()
    const client = new MongoClient(uri)
    globalThis._mongoClientPromise = client.connect()
  }
  return globalThis._mongoClientPromise
}

export async function getDb() {
  const uri = getDatabaseUrl()
  const dbName = getDbNameFromUri(uri)
  const client = await getClientPromise()
  return client.db(dbName)
}
