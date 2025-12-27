import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type RouteContext = { params: Promise<{ id: string }> }
type CourseStatus = "ACTIVE" | "SCHEDULED" | "INACTIVE"

function isCourseStatus(value: unknown): value is CourseStatus {
  return value === "ACTIVE" || value === "SCHEDULED" || value === "INACTIVE"
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { id } = await params
  let courseObjectId: ObjectId
  try {
    courseObjectId = new ObjectId(id)
  } catch {
    return NextResponse.json({ message: "Invalid course id" }, { status: 400 })
  }

  const db = await getDb()
  const course = await db.collection("Course").findOne({ _id: courseObjectId })
  if (!course) return NextResponse.json({ message: "Course not found" }, { status: 404 })

  return NextResponse.json({ id: course._id.toString(), ...course, _id: undefined })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { id } = await params
  let courseObjectId: ObjectId
  try {
    courseObjectId = new ObjectId(id)
  } catch {
    return NextResponse.json({ message: "Invalid course id" }, { status: 400 })
  }

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, classId, teacherId, status } = body as {
    name?: unknown
    classId?: unknown
    teacherId?: unknown
    status?: unknown
  }

  const update: Record<string, unknown> = { updatedAt: new Date() }
  const db = await getDb()

  if (typeof name === "string") update.name = name.trim()

  if (typeof classId === "string") {
    try {
      new ObjectId(classId)
    } catch {
      return NextResponse.json({ message: "Invalid classId" }, { status: 400 })
    }
    const cls = await db.collection("Class").findOne({ _id: new ObjectId(classId) }, { projection: { _id: 1 } })
    if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 400 })
    update.classId = classId
  }

  if (teacherId === null) {
    update.teacherId = null
  } else if (typeof teacherId === "string") {
    try {
      new ObjectId(teacherId)
    } catch {
      return NextResponse.json({ message: "Invalid teacherId" }, { status: 400 })
    }
    const teacher = await db.collection("User").findOne({ _id: new ObjectId(teacherId) }, { projection: { role: 1, isActive: 1 } })
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 })
    }
    update.teacherId = teacherId
  }

  if (status !== undefined) {
    if (!isCourseStatus(status)) return NextResponse.json({ message: "Invalid status" }, { status: 400 })
    update.status = status
  }

  const updated = await db.collection("Course").findOneAndUpdate(
    { _id: courseObjectId },
    { $set: update },
    { returnDocument: "after" },
  )
  const value = updated?.value
  if (!value) return NextResponse.json({ message: "Course not found" }, { status: 404 })

  return NextResponse.json({ id: value._id.toString(), ...value, _id: undefined })
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { id } = await params
  let courseObjectId: ObjectId
  try {
    courseObjectId = new ObjectId(id)
  } catch {
    return NextResponse.json({ message: "Invalid course id" }, { status: 400 })
  }

  const db = await getDb()
  const deleted = await db.collection("Course").deleteOne({ _id: courseObjectId })
  if (!deleted.deletedCount) return NextResponse.json({ message: "Course not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

