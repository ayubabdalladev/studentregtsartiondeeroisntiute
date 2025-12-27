// GET /api/reports/summary
import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type ChartPoint = { label: string; value: number }
type WeeklyAttendancePoint = { label: string; present: number; absent: number }

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 0, 0, 0, 0)
}

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const db = await getDb()

  const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
    db.collection("Student").countDocuments({ isActive: true }),
    db.collection("User").countDocuments({ role: "TEACHER", isActive: true }),
    db.collection("Class").countDocuments({}),
  ])

  const [paidStudents, unpaidStudents] = await Promise.all([
    db.collection("Student").countDocuments({ isActive: true, paymentStatus: "PAID" }),
    db.collection("Student").countDocuments({ isActive: true, paymentStatus: "UNPAID" }),
  ])

  const now = new Date()
  const monthStart = startOfMonth(now)
  const nextMonthStart = addMonths(monthStart, 1)

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

  const byDay = new Map<string, { present: number; absent: number }>()
  for (const row of attendanceAgg as Array<{ _id: { day: string; status: string }; count: number }>) {
    const existing = byDay.get(row._id.day) ?? { present: 0, absent: 0 }
    if (row._id.status === "PRESENT") existing.present = row.count
    if (row._id.status === "ABSENT") existing.absent = row.count
    byDay.set(row._id.day, existing)
  }

  const weeklyAttendance: WeeklyAttendancePoint[] = []
  let totalPresent = 0
  let totalAbsent = 0
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    const dayKey = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString(undefined, { weekday: "short" })
    const day = byDay.get(dayKey) ?? { present: 0, absent: 0 }
    weeklyAttendance.push({ label: dayLabel, present: day.present, absent: day.absent })
    totalPresent += day.present
    totalAbsent += day.absent
  }

  const attendanceRate = totalPresent + totalAbsent > 0 ? (totalPresent / (totalPresent + totalAbsent)) * 100 : 0

  const trendStart = addMonths(startOfMonth(now), -5)
  const trendEnd = addMonths(startOfMonth(now), 1)

  const enrollmentAgg = await db
    .collection("Student")
    .aggregate([
      { $match: { createdAt: { $gte: trendStart, $lt: trendEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  const enrollmentMap = new Map<string, number>(
    (enrollmentAgg as Array<{ _id: string; count: number }>).map((r) => [r._id, r.count]),
  )

  const enrollmentTrends: ChartPoint[] = []
  for (let m = 0; m < 6; m++) {
    const dt = addMonths(trendStart, m)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
    const label = dt.toLocaleDateString(undefined, { month: "short" })
    enrollmentTrends.push({ label, value: enrollmentMap.get(key) ?? 0 })
  }

  return NextResponse.json({
    totalStudents,
    totalTeachers,
    totalClasses,
    attendanceRate,
    paidStudents,
    unpaidStudents,
    monthlyRevenue,
    weeklyAttendance,
    enrollmentTrends,
  })
}
