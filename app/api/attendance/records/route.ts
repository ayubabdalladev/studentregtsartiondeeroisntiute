import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

function parseDateRange(dateParam: string | null) {
  const date = dateParam ? new Date(dateParam) : new Date()
  if (Number.isNaN(date.getTime())) return null
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return { dayStart, dayEnd }
}

function toObjectId(id: string) {
  try {
    return new ObjectId(id)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  const range = parseDateRange(searchParams.get("date"))
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "200"), 1), 1000)

  const db = await getDb()

  const rows = await db
    .collection("Attendance")
    .find({ classId, date: { $gte: range.dayStart, $lt: range.dayEnd } })
    .project({ studentId: 1, teacherId: 1, status: 1, note: 1, date: 1, createdAt: 1 })
    .limit(limit)
    .toArray()

  const studentObjectIds = Array.from(new Set(rows.map((r) => String(r.studentId)))).map(toObjectId).filter((x): x is ObjectId => Boolean(x))
  const teacherObjectIds = Array.from(new Set(rows.map((r) => String(r.teacherId)))).map(toObjectId).filter((x): x is ObjectId => Boolean(x))
  const classObjectId = toObjectId(classId)

  const [students, teachers, cls] = await Promise.all([
    studentObjectIds.length
      ? db.collection("Student").find({ _id: { $in: studentObjectIds } }).project({ firstName: 1, lastName: 1, email: 1, phone: 1 }).toArray()
      : Promise.resolve([]),
    teacherObjectIds.length
      ? db.collection("User").find({ _id: { $in: teacherObjectIds } }).project({ name: 1, email: 1, role: 1 }).toArray()
      : Promise.resolve([]),
    classObjectId ? db.collection("Class").findOne({ _id: classObjectId }, { projection: { name: 1, level: 1 } }) : Promise.resolve(null),
  ])

  const studentMap = new Map(
    students.map((s) => [
      s._id.toString(),
      {
        id: s._id.toString(),
        firstName: (s.firstName as string) ?? "",
        lastName: (s.lastName as string) ?? "",
        email: (s.email as string | null | undefined) ?? null,
        phone: (s.phone as string | null | undefined) ?? null,
      },
    ]),
  )
  const teacherMap = new Map(
    teachers
      .filter((t) => t.role === "TEACHER")
      .map((t) => [
        t._id.toString(),
        { id: t._id.toString(), name: (t.name as string) ?? "", email: (t.email as string) ?? "" },
      ]),
  )

  const classInfo = cls
    ? { id: classId, name: (cls.name as string) ?? "", level: (cls.level as string | null | undefined) ?? null }
    : { id: classId, name: classId, level: null }

  const data = rows
    .map((r) => {
      const student = studentMap.get(String(r.studentId)) ?? null
      const teacher = teacherMap.get(String(r.teacherId)) ?? null
      return {
        id: r._id.toString(),
        class: classInfo,
        date: (r.date as Date).toISOString(),
        createdAt: ((r.createdAt as Date | null | undefined) ?? null)?.toISOString?.() ?? null,
        status: (r.status as "PRESENT" | "ABSENT") ?? "ABSENT",
        note: (r.note as string | null | undefined) ?? null,
        student,
        teacher,
      }
    })
    .sort((a, b) => {
      const an = `${a.student?.lastName ?? ""} ${a.student?.firstName ?? ""}`.toLowerCase()
      const bn = `${b.student?.lastName ?? ""} ${b.student?.firstName ?? ""}`.toLowerCase()
      return an.localeCompare(bn)
    })

  return NextResponse.json({
    date: range.dayStart.toISOString().slice(0, 10),
    class: classInfo,
    total: data.length,
    data,
  })
}

