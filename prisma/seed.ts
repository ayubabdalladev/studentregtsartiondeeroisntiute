import "dotenv/config"
import bcrypt from "bcryptjs"
import { MongoClient } from "mongodb"

async function main() {
  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error("DATABASE_URL is not set")

  const adminPassword = await bcrypt.hash("admin@deero123", 10)
  const teacherPassword = await bcrypt.hash("teacher123", 10)

  const client = new MongoClient(uri)
  await client.connect()

  const dbName = new URL(uri).pathname.replace(/^\//, "") || undefined
  const db = client.db(dbName)

  const users = db.collection("User")

  await users.updateOne(
    { email: "admin@deeroinst6.com" },
    {
      $setOnInsert: { createdAt: new Date() },
      $set: { name: "System Admin", role: "ADMIN", isActive: true, password: adminPassword, updatedAt: new Date() },
    },
    { upsert: true },
  )

  await users.updateOne(
    { email: "teacher@school.com" },
    {
      $setOnInsert: { password: teacherPassword, createdAt: new Date() },
      $set: { name: "Main Teacher", role: "TEACHER", isActive: true, updatedAt: new Date() },
    },
    { upsert: true },
  )

  console.log("Seed completed:")

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
