import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { enqueueAndSendWhatsAppMessage, hasRecentAbsenceAlert } from "@/lib/whatsapp-queue"
import { enqueueAndSendEmailMessage, hasRecentAbsenceEmailAlert } from "@/lib/email-queue"
import { buildBroadcastEmailTemplate } from "@/lib/email-templates"

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body = await req.json()

  const date = new Date(body.date) // e.g. "2025-12-27"
  if (Number.isNaN(date.getTime())) return NextResponse.json({ message: "Invalid date" }, { status: 400 })

  const classId = body.classId as string
  if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 })

  let classObjectId: ObjectId
  try {
    classObjectId = new ObjectId(classId)
  } catch {
    return NextResponse.json({ message: "Invalid classId" }, { status: 400 })
  }

  const teacherId = session.userId

  const items = body.items as Array<{ studentId: string; status: "PRESENT" | "ABSENT"; note?: string }>
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ message: "items is required" }, { status: 400 })
  }

  const db = await getDb()
  const cls = await db.collection("Class").findOne({ _id: classObjectId }, { projection: { teacherId: 1, isActive: 1 } })
  if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
  if (!cls.isActive) return NextResponse.json({ message: "Class is inactive" }, { status: 400 })
  if ((cls.teacherId as string | null | undefined) !== teacherId) {
    return NextResponse.json({ message: "You are not assigned to this class" }, { status: 403 })
  }

  const studentIds = items.map((it) => it.studentId)
  const uniqueStudentIds = Array.from(new Set(studentIds))

  const objectIds = uniqueStudentIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  if (objectIds.length !== uniqueStudentIds.length) {
    return NextResponse.json({ message: "Invalid studentId in items" }, { status: 400 })
  }

  const students = await db
    .collection("Student")
    .find({ _id: { $in: objectIds }, classId })
    .project({ _id: 1 })
    .toArray()

  if (students.length !== uniqueStudentIds.length) {
    return NextResponse.json({ message: "Some students do not belong to this class" }, { status: 400 })
  }

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  await db.collection("Attendance").deleteMany({
    classId,
    studentId: { $in: uniqueStudentIds },
    date: { $gte: dayStart, $lt: dayEnd },
  })

  const docs = items.map((it) => ({
    date: dayStart,
    classId,
    teacherId,
    studentId: it.studentId,
    status: it.status,
    note: it.note ?? null,
    createdAt: new Date(),
  }))

  const created = await db.collection("Attendance").insertMany(docs)

  const channel = (process.env.NOTIFICATIONS_CHANNEL ?? "email").toLowerCase()

  // Auto WhatsApp alert: if a student hits 3 absences within the last 30 days, send one alert (once per 30-day window).
  const absentStudentIds = Array.from(new Set(items.filter((x) => x.status === "ABSENT").map((x) => x.studentId)))
  if (absentStudentIds.length) {
    const windowDays = 30
    const threshold = 3
    const since = new Date(dayStart)
    since.setDate(since.getDate() - windowDays)

    const phones = await db
      .collection("Student")
      .find({ _id: { $in: absentStudentIds.map((sid) => new ObjectId(sid)) } })
      .project({ firstName: 1, lastName: 1, phone: 1, email: 1, classId: 1 })
      .toArray()

    const phoneMap = new Map<string, { name: string; phone: string | null }>(
      phones.map((s) => [
        s._id.toString(),
        { name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student", phone: (s.phone as string | null | undefined) ?? null },
      ]),
    )

    const emailMap = new Map<string, { name: string; email: string | null }>(
      phones.map((s) => [
        s._id.toString(),
        { name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "Student", email: (s.email as string | null | undefined) ?? null },
      ]),
    )

    await Promise.all(
      absentStudentIds.map(async (studentId) => {
        const count = await db.collection("Attendance").countDocuments({
          studentId,
          classId,
          status: "ABSENT",
          date: { $gte: since, $lte: dayStart },
        })

        if (count < threshold) return

        const msg = `Attendance Alert: ${emailMap.get(studentId)?.name ?? "Student"} has been absent ${threshold} times in the last ${windowDays} days. Please ensure attendance improves.`

        if (channel === "whatsapp" || channel === "both") {
          const already = await hasRecentAbsenceAlert({ studentId, classId, absentCount: threshold, withinDays: windowDays })
          if (!already) {
            const info = phoneMap.get(studentId) ?? { name: "Student", phone: null }
            await enqueueAndSendWhatsAppMessage({
              to: info.phone,
              body: msg,
              meta: { kind: "ABSENCE_ALERT", studentId, classId, absentCount: threshold, windowDays },
            })
          }
        }

        if (channel === "email" || channel === "both") {
          const already = await hasRecentAbsenceEmailAlert({ studentId, classId, absentCount: threshold, withinDays: windowDays })
          if (already) return
          const info = emailMap.get(studentId) ?? { name: "Student", email: null }
          const template = buildBroadcastEmailTemplate({
            subject: "Attendance Alert",
            message: msg,
            contextTitle: "Attendance Alert",
            contextSubtitle: `Class: ${classId}`,
            logoCid: "brandlogo",
            brandName: process.env.EMAIL_BRAND_NAME ?? "Deero Institute",
          })
          await enqueueAndSendEmailMessage({
            to: info.email,
            subject: "Attendance Alert",
            text: template.text,
            html: template.html,
            meta: { kind: "ABSENCE_ALERT", studentId, classId, absentCount: threshold, windowDays },
          })
        }
      }),
    )
  }

  return NextResponse.json({ ok: true, count: created.insertedCount })
}
