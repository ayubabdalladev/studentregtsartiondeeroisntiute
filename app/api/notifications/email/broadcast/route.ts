import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { enqueueAndSendEmailMessage } from "@/lib/email-queue"
import { buildBroadcastEmailTemplate } from "@/lib/email-templates"

function toObjectId(id: string) {
  try {
    return new ObjectId(id)
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { subject, message, classId, courseId } = body as {
    subject?: unknown
    message?: unknown
    classId?: unknown
    courseId?: unknown
  }

  if (typeof subject !== "string" || !subject.trim()) return NextResponse.json({ message: "subject is required" }, { status: 400 })
  if (typeof message !== "string" || !message.trim()) return NextResponse.json({ message: "message is required" }, { status: 400 })

  const db = await getDb()

  let resolvedClassId: string | null = null
  let resolvedCourseId: string | null = null
  let contextSubtitle: string | null = null

  if (typeof courseId === "string" && courseId) {
    const oid = toObjectId(courseId)
    if (!oid) return NextResponse.json({ message: "Invalid courseId" }, { status: 400 })
    const course = await db.collection("Course").findOne({ _id: oid }, { projection: { classId: 1, name: 1 } })
    if (!course) return NextResponse.json({ message: "Course not found" }, { status: 404 })
    resolvedCourseId = courseId
    resolvedClassId = (course.classId as string | null | undefined) ?? null
    contextSubtitle = course.name ? `Course: ${course.name}` : "Course announcement"
  }

  if (!resolvedClassId && typeof classId === "string" && classId) {
    const oid = toObjectId(classId)
    if (!oid) return NextResponse.json({ message: "Invalid classId" }, { status: 400 })
    const cls = await db.collection("Class").findOne({ _id: oid }, { projection: { name: 1 } })
    if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
    resolvedClassId = classId
    contextSubtitle = cls.name ? `Class: ${cls.name}` : "Class announcement"
  }

  if (!resolvedClassId) return NextResponse.json({ message: "classId or courseId is required" }, { status: 400 })

  const students = await db
    .collection("Student")
    .find({ classId: resolvedClassId, isActive: true })
    .project({ email: 1 })
    .toArray()

  const template = buildBroadcastEmailTemplate({
    subject: subject.trim(),
    message: message.trim(),
    contextTitle: subject.trim(),
    contextSubtitle,
    logoCid: "brandlogo",
    brandName: process.env.EMAIL_BRAND_NAME ?? "Deero Institute",
  })

  const results = await Promise.all(
    students.map((s) =>
      enqueueAndSendEmailMessage({
        to: (s.email as string | null | undefined) ?? null,
        subject: subject.trim(),
        text: template.text,
        html: template.html,
        meta: { kind: "BROADCAST", initiatedBy: session.userId, classId: resolvedClassId!, courseId: resolvedCourseId },
      }),
    ),
  )

  const sent = results.filter((r) => r.ok && r.status === "SENT").length
  const skipped = results.filter((r) => r.ok && r.status === "SKIPPED").length
  const failed = results.filter((r) => !r.ok || r.status === "FAILED").length

  return NextResponse.json({
    ok: true,
    classId: resolvedClassId,
    courseId: resolvedCourseId,
    total: results.length,
    sent,
    skipped,
    failed,
  })
}
