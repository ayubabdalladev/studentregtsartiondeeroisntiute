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
  const range = parseDateRange(searchParams.get("date"))
  if (!range) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const db = await getDb()
  const match: Record<string, unknown> = { date: { $gte: range.dayStart, $lt: range.dayEnd } }
  if (classId) match.classId = classId

  const grouped = await db
    .collection("Attendance")
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: "$classId",
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] } },
          total: { $sum: 1 },
          teacherIds: { $addToSet: "$teacherId" },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  const classIds = grouped.map((g) => String(g._id)).filter(Boolean)
  const classObjectIds = classIds.map(toObjectId).filter((x): x is ObjectId => Boolean(x))

  const classes = classObjectIds.length
    ? await db.collection("Class").find({ _id: { $in: classObjectIds } }).project({ name: 1, level: 1 }).toArray()
    : []
  const classMap = new Map(classes.map((c) => [c._id.toString(), { id: c._id.toString(), name: (c.name as string) ?? "", level: (c.level as string | null | undefined) ?? null }]))

  const teacherIdSet = new Set<string>()
  for (const row of grouped) {
    for (const tid of (row.teacherIds as string[] | undefined) ?? []) teacherIdSet.add(tid)
  }
  const teacherObjectIds = Array.from(teacherIdSet).map(toObjectId).filter((x): x is ObjectId => Boolean(x))
  const teachers = teacherObjectIds.length
    ? await db.collection("User").find({ _id: { $in: teacherObjectIds } }).project({ name: 1, email: 1, role: 1 }).toArray()
    : []
  const teacherMap = new Map(
    teachers
      .filter((t) => t.role === "TEACHER")
      .map((t) => [t._id.toString(), { id: t._id.toString(), name: (t.name as string) ?? "", email: (t.email as string) ?? "" }]),
  )

  const data = grouped.map((g) => {
    const id = String(g._id)
    const total = Number(g.total ?? 0)
    const presentCount = Number(g.presentCount ?? 0)
    const absentCount = Number(g.absentCount ?? 0)
    const percentage = total ? Math.round((presentCount / total) * 100) : 0
    const classInfo = classMap.get(id) ?? { id, name: id, level: null }
    const teacherList = ((g.teacherIds as string[] | undefined) ?? [])
      .map((tid) => teacherMap.get(tid))
      .filter((x): x is { id: string; name: string; email: string } => Boolean(x))
    return {
      class: classInfo,
      presentCount,
      absentCount,
      total,
      percentage,
      teachers: teacherList,
    }
  })

  return NextResponse.json({
    date: range.dayStart.toISOString().slice(0, 10),
    data,
  })
}

