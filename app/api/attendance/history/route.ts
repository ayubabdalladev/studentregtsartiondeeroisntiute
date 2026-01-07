import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

function toObjectId(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  const db = await getDb()
  
  // Get date range (default to last 30 days)
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 30)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const classObjectId = toObjectId(classId)
  const cls = await db.collection("Class").findOne({ _id: classObjectId })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })

  // Get students in this class
  const students = await db.collection("Student")
    .find({ classId: classId })
    .project({ firstName: 1, lastName: 1 })
    .toArray()

  // Get all attendance for this range and class
  const records = await db.collection("Attendance")
    .find({ 
      classId: classId,
      date: { $gte: start, $lte: end }
    })
    .project({ studentId: 1, date: 1, status: 1 })
    .toArray()

  // Structure the data: studentId -> { dateString: status }
  const historyMap: Record<string, Record<string, string>> = {}
  
  records.forEach(r => {
    const sId = String(r.studentId)
    const dStr = (r.date as Date).toISOString().split('T')[0]
    if (!historyMap[sId]) historyMap[sId] = {}
    historyMap[sId][dStr] = r.status as string
  })

  return NextResponse.json({
    class: { id: classId, name: cls.name },
    students: students.map(s => ({
      id: s._id.toString(),
      name: `${s.firstName} ${s.lastName}`.trim()
    })),
    history: historyMap,
    startDate: start.toISOString(),
    endDate: end.toISOString()
  })
}
