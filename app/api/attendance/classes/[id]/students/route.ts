import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  let classObjectId: ObjectId
  try {
    classObjectId = new ObjectId(id)
  } catch {
    return NextResponse.json({ message: "Invalid class id" }, { status: 400 })
  }

  const db = await getDb()
  const cls = await db.collection("Class").findOne({ _id: classObjectId }, { projection: { teacherId: 1, isActive: 1 } })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
  if (!cls.isActive) return NextResponse.json({ message: "Class is inactive" }, { status: 400 })
  if ((cls.teacherId as string | null | undefined) !== session.userId) {
    return NextResponse.json({ message: "You are not assigned to this class" }, { status: 403 })
  }

  const classId = classObjectId.toString()
  const students = await db
    .collection("Student")
    .find({ classId, isActive: true })
    .project({ firstName: 1, lastName: 1 })
    .sort({ lastName: 1, firstName: 1 })
    .toArray()

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date")
  let attendanceMap: Record<string, "PRESENT" | "ABSENT"> = {}

  if (dateStr) {
    const date = new Date(dateStr)
    if (!Number.isNaN(date.getTime())) {
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const records = await db
        .collection("Attendance")
        .find({ classId, teacherId: session.userId, date: { $gte: dayStart, $lt: dayEnd } })
        .project({ studentId: 1, status: 1 })
        .toArray()

      attendanceMap = Object.fromEntries(records.map((r) => [r.studentId as string, r.status as "PRESENT" | "ABSENT"]))
    }
  }

  return NextResponse.json({
    students: students.map((s) => ({ id: s._id.toString(), firstName: s.firstName, lastName: s.lastName })),
    attendance: attendanceMap,
  })
}
