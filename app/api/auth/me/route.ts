// GET /api/auth/me
import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  const db = await getDb()
  const user = await db
    .collection("User")
    .findOne({ _id: new ObjectId(session.userId) }, { projection: { name: 1, email: 1, role: 1, isActive: 1 } })

  if (!user || !user.isActive) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  })
}
