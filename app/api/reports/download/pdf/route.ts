import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const db = await getDb()
  const now = new Date()

  const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
    db.collection("Student").countDocuments({ isActive: true }),
    db.collection("User").countDocuments({ role: "TEACHER", isActive: true }),
    db.collection("Class").countDocuments({}),
  ])

  const [paidStudents, unpaidStudents] = await Promise.all([
    db.collection("Student").countDocuments({ isActive: true, paymentStatus: "PAID" }),
    db.collection("Student").countDocuments({ isActive: true, paymentStatus: "UNPAID" }),
  ])

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)

  const revenueAgg = await db
    .collection("Payment")
    .aggregate([
      { $match: { paidAt: { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
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

  const weeklyRows: Array<{ dayLabel: string; present: number; absent: number }> = []
  let totalPresent = 0
  let totalAbsent = 0
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString(undefined, { weekday: "short" })
    const row = weeklyMap.get(key) ?? { present: 0, absent: 0 }
    weeklyRows.push({ dayLabel: label, present: row.present, absent: row.absent })
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

  const enrollmentData = (enrollmentAgg as Array<{ _id: string; count: number }>).map((r) => ({ month: r._id, count: r.count }))

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = height - 50

  page.drawText("School Report", {
    x: 50,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  })

  y -= 24
  page.drawText(`Generated: ${now.toLocaleString()}`, {
    x: 50,
    y,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= 30
  page.drawText("Summary", { x: 50, y, size: 14, font: boldFont })
  y -= 18

  const lineHeight = 14
  const writeLine = (text: string) => {
    if (y < 60) {
      // simple overflow handling: start a new page
      const newPage = pdfDoc.addPage([width, height])
      y = height - 60
      page.drawText("Continued", { x: 50, y, size: 12, font })
      y -= 20
    }
    page.drawText(text, { x: 60, y, size: 11, font })
    y -= lineHeight
  }

  writeLine(`Total students: ${totalStudents}`)
  writeLine(`Total teachers: ${totalTeachers}`)
  writeLine(`Total classes: ${totalClasses}`)
  writeLine(`Attendance rate: ${attendanceRate.toFixed(1)}%`)
  writeLine(`Paid students: ${paidStudents}`)
  writeLine(`Unpaid students: ${unpaidStudents}`)
  writeLine(`Monthly revenue: ${monthlyRevenue}`)

  y -= 10
  page.drawText("Weekly Attendance (last 7 days)", { x: 50, y, size: 14, font: boldFont })
  y -= 18
  for (const row of weeklyRows) {
    writeLine(`${row.dayLabel}: Present ${row.present}, Absent ${row.absent}`)
  }

  y -= 10
  page.drawText("Enrollment (last 6 months)", { x: 50, y, size: 14, font: boldFont })
  y -= 18
  for (const row of enrollmentData) {
    writeLine(`${row.month}: ${row.count} new students`)
  }

  const pdfBytes = await pdfDoc.save()
  const filename = `school-report-${now.toISOString().slice(0, 10)}.pdf`

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
