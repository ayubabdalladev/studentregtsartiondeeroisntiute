import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type CourseStatus = "ACTIVE" | "SCHEDULED" | "INACTIVE"

function isCourseStatus(value: unknown): value is CourseStatus {
  return value === "ACTIVE" || value === "SCHEDULED" || value === "INACTIVE"
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  const teacherId = searchParams.get("teacherId")
  const status = searchParams.get("status")

  const query: Record<string, unknown> = {}
  if (classId) query.classId = classId
  if (teacherId) query.teacherId = teacherId
  if (status) query.status = status

  const courses = await db.collection("Course").find(query).sort({ createdAt: -1 }).toArray()

  const classIds = Array.from(
    new Set(courses.map((c) => (c.classId as string | null | undefined) ?? null).filter((x): x is string => Boolean(x))),
  )
  const teacherIds = Array.from(
    new Set(
      courses.map((c) => (c.teacherId as string | null | undefined) ?? null).filter((x): x is string => Boolean(x)),
    ),
  )

  const classOids = classIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  const teacherOids = teacherIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  const [classes, teachers, counts] = await Promise.all([
    classOids.length
      ? db.collection("Class").find({ _id: { $in: classOids } }).project({ name: 1, level: 1, isActive: 1 }).toArray()
      : [],
    teacherOids.length
      ? db.collection("User").find({ _id: { $in: teacherOids } }).project({ name: 1, email: 1, role: 1 }).toArray()
      : [],
    classIds.length
      ? db
          .collection("Student")
          .aggregate([
            { $match: { classId: { $in: classIds }, isActive: true } },
            { $group: { _id: "$classId", count: { $sum: 1 } } },
          ])
          .toArray()
      : [],
  ])

  const classMap = new Map<string, { id: string; name: string; level: string | null; isActive: boolean }>(
    classes.map((c) => [c._id.toString(), { id: c._id.toString(), name: c.name, level: c.level ?? null, isActive: Boolean(c.isActive) }]),
  )

  const teacherMap = new Map<string, { id: string; name: string; email: string }>(
    teachers
      .filter((t) => t.role === "TEACHER")
      .map((t) => [t._id.toString(), { id: t._id.toString(), name: t.name, email: t.email }]),
  )

  const countMap = new Map<string, number>(counts.map((r) => [r._id as string, r.count as number]))

  return NextResponse.json(
    courses.map((course) => {
      const id = course._id.toString()
      const clsId = (course.classId as string | null | undefined) ?? null
      const tid = (course.teacherId as string | null | undefined) ?? null
      return {
        id,
        name: course.name,
        classId: clsId,
        class: clsId ? classMap.get(clsId) ?? null : null,
        teacherId: tid,
        teacher: tid ? teacherMap.get(tid) ?? null : null,
        status: course.status ?? "ACTIVE",
        studentsCount: clsId ? countMap.get(clsId) ?? 0 : 0,
        createdAt: course.createdAt ?? null,
        updatedAt: course.updatedAt ?? null,
      }
    }),
  )
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { name, classId, teacherId, status } = body as {
    name?: unknown
    classId?: unknown
    teacherId?: unknown
    status?: unknown
  }

  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ message: "Course name is required" }, { status: 400 })
  if (typeof classId !== "string" || !classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  let classObjectId: ObjectId
  try {
    classObjectId = new ObjectId(classId)
  } catch {
    return NextResponse.json({ message: "Invalid classId" }, { status: 400 })
  }

  const db = await getDb()
  const cls = await db.collection("Class").findOne({ _id: classObjectId }, { projection: { _id: 1 } })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 400 })

  const tid = typeof teacherId === "string" && teacherId ? teacherId : null
  if (tid) {
    try {
      new ObjectId(tid)
    } catch {
      return NextResponse.json({ message: "Invalid teacherId" }, { status: 400 })
    }
    const teacher = await db.collection("User").findOne({ _id: new ObjectId(tid) }, { projection: { role: 1, isActive: 1 } })
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 })
    }
  }

  const courseStatus: CourseStatus = isCourseStatus(status) ? status : "ACTIVE"
  const now = new Date()
  const inserted = await db.collection("Course").insertOne({
    name: name.trim(),
    classId,
    teacherId: tid,
    status: courseStatus,
    createdAt: now,
    updatedAt: now,
  })

  const studentsCount = await db.collection("Student").countDocuments({ classId, isActive: true })

  return NextResponse.json(
    {
      id: inserted.insertedId.toString(),
      name: name.trim(),
      classId,
      teacherId: tid,
      status: courseStatus,
      studentsCount,
    },
    { status: 201 },
  )
}

