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

  const { studentId, subject, message } = body as {
    studentId?: unknown
    subject?: unknown
    message?: unknown
  }

  if (typeof studentId !== "string" || !studentId) return NextResponse.json({ message: "studentId is required" }, { status: 400 })
  if (typeof subject !== "string" || !subject.trim()) return NextResponse.json({ message: "subject is required" }, { status: 400 })
  if (typeof message !== "string" || !message.trim()) return NextResponse.json({ message: "message is required" }, { status: 400 })

  const db = await getDb()
  const oid = toObjectId(studentId)
  if (!oid) return NextResponse.json({ message: "Invalid studentId" }, { status: 400 })

  const student = await db.collection("Student").findOne({ _id: oid }, { projection: { email: 1, firstName: 1, lastName: 1 } })
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

  const personalSubject = subject.trim().replace(/\[\[name\]\]/g, (student.firstName as string) || "Student")
  const personalMessage = message.trim().replace(/\[\[name\]\]/g, (student.firstName as string) || "Student")

  const template = buildBroadcastEmailTemplate({
    subject: personalSubject,
    message: personalMessage,
    contextTitle: personalSubject,
    contextSubtitle: `Personal notification for ${student.firstName} ${student.lastName}`,
    logoCid: "brandlogo",
    brandName: process.env.EMAIL_BRAND_NAME ?? "Deero Institute",
  })

  const result = await enqueueAndSendEmailMessage({
    to: (student.email as string | null | undefined) ?? null,
    subject: personalSubject,
    text: template.text,
    html: template.html,
    meta: { kind: "SINGLE", initiatedBy: session.userId, studentId },
  })

  if (!result.ok) {
    return NextResponse.json({ message: result.error || "Failed to send email" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: result.status })
}
