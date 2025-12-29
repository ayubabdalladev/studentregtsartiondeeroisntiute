import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type ActivityRow = {
  id: string
  type: "enrollment" | "attendance" | "payment" | "teacher" | "class" | "course"
  message: string
  timestamp: string
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function toObjectId(value: string) {
  try {
    return new ObjectId(value)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 25)
  const perTypeLimit = Math.min(Math.max(limit, 6), 12)

  const db = await getDb()

  const [students, payments, attendances, teachers, recentClasses, courses] = await Promise.all([
    db
      .collection("Student")
      .find({})
      .project({ firstName: 1, lastName: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1 })
      .limit(perTypeLimit)
      .toArray(),
    db
      .collection("Payment")
      .find({})
      .project({ studentId: 1, amount: 1, currency: 1, paidAt: 1, createdAt: 1 })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(perTypeLimit)
      .toArray(),
    db
      .collection("Attendance")
      .aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { classId: "$classId", date: "$date" },
            classId: { $first: "$classId" },
            createdAt: { $first: "$createdAt" },
            date: { $first: "$date" },
          },
        },
        { $limit: perTypeLimit },
      ])
      .toArray(),
    db
      .collection("User")
      .find({ role: "TEACHER" })
      .project({ name: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1 })
      .limit(perTypeLimit)
      .toArray(),
    db
      .collection("Class")
      .find({})
      .project({ name: 1, level: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1 })
      .limit(perTypeLimit)
      .toArray(),
    db
      .collection("Course")
      .find({})
      .project({ name: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1 })
      .limit(perTypeLimit)
      .toArray(),
  ])

  const studentActivities: ActivityRow[] = students.map((s) => {
    const name = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student"
    const timestamp = normalizeDate(s.createdAt ?? s.updatedAt)
    return {
      id: `student-${s._id.toString()}`,
      type: "enrollment",
      message: `New student enrollment: ${name}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const paymentStudentIds = Array.from(
    new Set(
      payments
        .map((p) => (p.studentId as string | null | undefined) ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const paymentStudentObjectIds = paymentStudentIds
    .map((id) => toObjectId(id))
    .filter((id): id is ObjectId => Boolean(id))
  const paymentStudents = paymentStudentObjectIds.length
    ? await db
        .collection("Student")
        .find({ _id: { $in: paymentStudentObjectIds } })
        .project({ firstName: 1, lastName: 1 })
        .toArray()
    : []
  const paymentStudentMap = new Map<string, string>(
    paymentStudents.map((s) => [s._id.toString(), `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student"]),
  )

  const paymentActivities: ActivityRow[] = payments.map((p) => {
    const studentId = (p.studentId as string | null | undefined) ?? null
    const studentName = studentId ? paymentStudentMap.get(studentId) ?? "Student" : "Student"
    const amount = Number(p.amount ?? 0)
    const currency = (p.currency as string | null | undefined) ?? "USD"
    const amountLabel = amount > 0 ? `${amount.toLocaleString()} ${currency}` : null
    const timestamp = normalizeDate(p.paidAt ?? p.createdAt)
    return {
      id: `payment-${p._id.toString()}`,
      type: "payment",
      message: amountLabel ? `Payment received: ${amountLabel} from ${studentName}` : `Payment received from ${studentName}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const classIds = Array.from(
    new Set(
      attendances
        .map((a) => (a.classId as string | null | undefined) ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const classObjectIds = classIds
    .map((id) => toObjectId(id))
    .filter((id): id is ObjectId => Boolean(id))
  const classLookupRows = classObjectIds.length
    ? await db.collection("Class").find({ _id: { $in: classObjectIds } }).project({ name: 1 }).toArray()
    : []
  const classMap = new Map<string, string>(classLookupRows.map((c) => [c._id.toString(), c.name ?? "Class"]))

  const attendanceActivities: ActivityRow[] = attendances.map((a: any) => {
    const classId = (a.classId as string | null | undefined) ?? null
    const className = classId ? classMap.get(classId) ?? "Class" : "Class"
    const timestamp = normalizeDate(a.createdAt ?? a.date)
    const idSuffix = `${classId ?? "class"}-${timestamp.toISOString()}`
    return {
      id: `attendance-${idSuffix}`,
      type: "attendance",
      message: `Attendance marked for ${className}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const teacherActivities: ActivityRow[] = teachers.map((t) => {
    const name = (t.name as string | null | undefined) ?? "Teacher"
    const timestamp = normalizeDate(t.createdAt ?? t.updatedAt)
    return {
      id: `teacher-${t._id.toString()}`,
      type: "teacher",
      message: `New teacher added: ${name}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const classActivities: ActivityRow[] = recentClasses.map((c) => {
    const name = (c.name as string | null | undefined) ?? "Class"
    const level = (c.level as string | null | undefined) ?? null
    const label = level ? `${name} (${level})` : name
    const timestamp = normalizeDate(c.createdAt ?? c.updatedAt)
    return {
      id: `class-${c._id.toString()}`,
      type: "class",
      message: `New class created: ${label}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const courseActivities: ActivityRow[] = courses.map((c) => {
    const name = (c.name as string | null | undefined) ?? "Course"
    const timestamp = normalizeDate(c.createdAt ?? c.updatedAt)
    return {
      id: `course-${c._id.toString()}`,
      type: "course",
      message: `New course created: ${name}`,
      timestamp: timestamp.toISOString(),
    }
  })

  const allActivities = [
    ...studentActivities,
    ...paymentActivities,
    ...attendanceActivities,
    ...teacherActivities,
    ...classActivities,
    ...courseActivities,
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const seen = new Set<string>()
  const activities: ActivityRow[] = []
  for (const item of allActivities) {
    const key = `${item.type}:${item.message}`
    if (seen.has(key)) continue
    seen.add(key)
    activities.push(item)
    if (activities.length >= limit) break
  }

  return NextResponse.json({ items: activities })
}
