import { MongoClient } from "mongodb"

const uri = process.env.DATABASE_URL
if (!uri) {
  throw new Error("DATABASE_URL is not set")
}

const dbName = (() => {
  try {
    const name = new URL(uri).pathname.replace(/^\//, "")
    return name || undefined
  } catch {
    return undefined
  }
})()

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient>

if (!globalThis._mongoClientPromise) {
  const client = new MongoClient(uri)
  globalThis._mongoClientPromise = client.connect()
}

clientPromise = globalThis._mongoClientPromise

export async function getDb() {
  const client = await clientPromise
  return client.db(dbName)
}

