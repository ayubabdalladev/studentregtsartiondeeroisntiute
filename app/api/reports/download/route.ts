import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function csvRow(...values: unknown[]) {
  return values.map(csvEscape).join(",")
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const db = await getDb()
  const now = new Date()

  const { searchParams } = new URL(req.url)
  const paymentsLimit = Math.min(Number(searchParams.get("paymentsLimit") ?? 200) || 200, 1000)

  const [studentsActive, teachersActive, classesTotal, paidStudents, unpaidStudents] = await Promise.all([
    db.collection("Student").countDocuments({ isActive: true }),
    db.collection("User").countDocuments({ role: "TEACHER", isActive: true }),
    db.collection("Class").countDocuments({}),
    db.collection("Student").countDocuments({ isActive: true, paymentStatus: "PAID" }),
    db.collection("Student").countDocuments({ isActive: true, paymentStatus: "UNPAID" }),
  ])

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)

  const revenueAgg = await db
    .collection("Payment")
    .aggregate([{ $match: { paidAt: { $gte: monthStart, $lt: nextMonthStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }])
    .toArray()
  const monthlyRevenue = revenueAgg[0]?.total ? Number(revenueAgg[0].total) : 0

  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekEnd = new Date(now)
  weekEnd.setHours(0, 0, 0, 0)
  weekEnd.setDate(weekEnd.getDate() + 1)

  const attendanceAgg = await db
    .collection("Attendance")
    .aggregate([
      { $match: { date: { $gte: weekStart, $lt: weekEnd } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()

  const weeklyMap = new Map<string, { present: number; absent: number }>()
  for (const row of attendanceAgg as Array<{ _id: { day: string; status: string }; count: number }>) {
    const cur = weeklyMap.get(row._id.day) ?? { present: 0, absent: 0 }
    if (row._id.status === "PRESENT") cur.present = row.count
    if (row._id.status === "ABSENT") cur.absent = row.count
    weeklyMap.set(row._id.day, cur)
  }

  let totalPresent = 0
  let totalAbsent = 0
  const weeklyRows: Array<{ day: string; present: number; absent: number }> = []
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    const key = d.toISOString().slice(0, 10)
    const row = weeklyMap.get(key) ?? { present: 0, absent: 0 }
    weeklyRows.push({ day: key, present: row.present, absent: row.absent })
    totalPresent += row.present
    totalAbsent += row.absent
  }
  const attendanceRate = totalPresent + totalAbsent > 0 ? (totalPresent / (totalPresent + totalAbsent)) * 100 : 0

  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0)
  const trendEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
  const enrollmentAgg = await db
    .collection("Student")
    .aggregate([
      { $match: { createdAt: { $gte: trendStart, $lt: trendEnd } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  const enrollmentMap = new Map<string, number>((enrollmentAgg as Array<{ _id: string; count: number }>).map((r) => [r._id, r.count]))
  const enrollmentRows: Array<{ month: string; count: number }> = []
  for (let i = 0; i < 6; i++) {
    const dt = new Date(trendStart.getFullYear(), trendStart.getMonth() + i, 1)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
    enrollmentRows.push({ month: key, count: enrollmentMap.get(key) ?? 0 })
  }

  const payments = await db.collection("Payment").find({}).sort({ paidAt: -1 }).limit(paymentsLimit).toArray()
  const paymentStudentIds = Array.from(
    new Set(payments.map((p) => (p.studentId as string | null | undefined) ?? null).filter((x): x is string => Boolean(x))),
  )
  const paymentStudentOids = paymentStudentIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  const students = paymentStudentOids.length
    ? await db
        .collection("Student")
        .find({ _id: { $in: paymentStudentOids } })
        .project({ firstName: 1, lastName: 1, classId: 1 })
        .toArray()
    : []

  const paymentClassIds = Array.from(
    new Set(students.map((s) => (s.classId as string | null | undefined) ?? null).filter((x): x is string => Boolean(x))),
  )
  const paymentClassOids = paymentClassIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  const classes = paymentClassOids.length
    ? await db.collection("Class").find({ _id: { $in: paymentClassOids } }).project({ name: 1 }).toArray()
    : []

  const classMap = new Map<string, string>(classes.map((c) => [c._id.toString(), c.name]))
  const studentMap = new Map<string, { name: string; className: string | null }>(
    students.map((s) => {
      const id = s._id.toString()
      const classId = (s.classId as string | null | undefined) ?? null
      return [id, { name: `${s.firstName} ${s.lastName}`, className: classId ? classMap.get(classId) ?? null : null }]
    }),
  )

  const lines: string[] = []

  // Unified, Excel-friendly layout: every row has the same number of columns
  lines.push(csvRow("section", "metric", "value1", "value2", "value3", "value4", "value5", "value6"))

  // Summary metrics
  lines.push(csvRow("SUMMARY", "generatedAt", now.toISOString(), "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "totalStudents", studentsActive, "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "totalTeachers", teachersActive, "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "totalClasses", classesTotal, "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "attendanceRate", attendanceRate.toFixed(2), "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "paidStudents", paidStudents, "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "unpaidStudents", unpaidStudents, "", "", "", "", ""))
  lines.push(csvRow("SUMMARY", "monthlyRevenue", monthlyRevenue, "", "", "", "", ""))

  // Enrollment trends
  for (const row of enrollmentRows) {
    lines.push(csvRow("ENROLLMENT", row.month, row.count, "", "", "", "", ""))
  }

  // Weekly attendance
  for (const row of weeklyRows) {
    lines.push(csvRow("WEEKLY_ATTENDANCE", row.day, row.present, row.absent, "", "", "", ""))
  }

  // Recent payments
  for (const p of payments) {
    const studentId = (p.studentId as string | null | undefined) ?? null
    const student = studentId ? studentMap.get(studentId) ?? null : null
    lines.push(
      csvRow(
        "PAYMENT",
        p.paidAt ? new Date(p.paidAt).toISOString() : "",
        student?.name ?? "",
        student?.className ?? "",
        Number(p.amount ?? 0),
        (p.currency as string | null | undefined) ?? "USD",
        (p.note as string | null | undefined) ?? "",
        "",
      ),
    )
  }

  const csv = lines.join("\n")
  const filename = `school-report-${now.toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

