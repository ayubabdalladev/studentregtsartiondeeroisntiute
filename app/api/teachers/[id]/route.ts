import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  let teacherObjectId: ObjectId
  try {
    teacherObjectId = new ObjectId(id)
  } catch {
    return NextResponse.json({ message: "Invalid teacher id" }, { status: 400 })
  }

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, email, password, isActive, classIds } = body as {
    name?: unknown
    email?: unknown
    password?: unknown
    isActive?: unknown
    classIds?: unknown
  }

  const update: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof name === "string") update.name = name.trim()
  if (typeof email === "string") update.email = email.trim().toLowerCase()
  if (typeof isActive === "boolean") update.isActive = isActive
  if (typeof password === "string" && password.length) update.password = await bcrypt.hash(password, 10)

  const db = await getDb()

  if (typeof update.email === "string") {
    const existing = await db
      .collection("User")
      .findOne({ email: update.email, _id: { $ne: teacherObjectId } }, { projection: { _id: 1 } })
    if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 409 })
  }

  const updated = await db.collection("User").findOneAndUpdate(
    { _id: teacherObjectId, role: "TEACHER" },
    { $set: update },
    { returnDocument: "after", projection: { name: 1, email: 1, isActive: 1 } },
  )

  const value = updated?.value
  if (!value) return NextResponse.json({ message: "Teacher not found" }, { status: 404 })

  const teacherId = teacherObjectId.toString()
  if (Array.isArray(classIds)) {
    const ids = classIds.filter((x): x is string => typeof x === "string")
    const objectIds = ids
      .map((id) => {
        try {
          return new ObjectId(id)
        } catch {
          return null
        }
      })
      .filter((id): id is ObjectId => Boolean(id))

    await db.collection("Class").updateMany({ teacherId }, { $set: { teacherId: null, updatedAt: new Date() } })
    if (objectIds.length) {
      await db.collection("Class").updateMany({ _id: { $in: objectIds } }, { $set: { teacherId, updatedAt: new Date() } })
    }
  }

  const classes = await db
    .collection("Class")
    .find({ teacherId })
    .project({ name: 1, level: 1 })
    .sort({ name: 1 })
    .toArray()

  return NextResponse.json({
    id: teacherId,
    name: value.name,
    email: value.email,
    isActive: Boolean(value.isActive),
    classes: classes.map((c) => ({ id: c._id.toString(), name: c.name, level: c.level ?? null })),
  })
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  let teacherObjectId: ObjectId
  try {
    teacherObjectId = new ObjectId(id)
  } catch {
    return NextResponse.json({ message: "Invalid teacher id" }, { status: 400 })
  }

  const db = await getDb()
  const teacherId = teacherObjectId.toString()

  await db.collection("Class").updateMany({ teacherId }, { $set: { teacherId: null, updatedAt: new Date() } })
  await db.collection("Course").updateMany({ teacherId }, { $set: { teacherId: null, updatedAt: new Date() } })

  const deleted = await db.collection("User").deleteOne({ _id: teacherObjectId, role: "TEACHER" })
  if (!deleted.deletedCount) return NextResponse.json({ message: "Teacher not found" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
