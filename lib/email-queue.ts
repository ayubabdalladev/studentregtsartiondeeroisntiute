import { getDb } from "@/lib/mongodb"
import { sendEmail } from "@/lib/email"
import type { SendMailOptions } from "nodemailer"

export type EmailMessageStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED"

export type EmailQueueMeta =
  | { kind: "BROADCAST"; initiatedBy: string; classId: string; courseId?: string | null }
  | { kind: "ABSENCE_ALERT"; studentId: string; classId: string; absentCount: number; windowDays: number }
  | { kind: "CERTIFICATE"; initiatedBy: string; classId: string; studentId: string }

export async function enqueueAndSendEmailMessage(args: {
  to: string | null
  subject: string
  text: string
  html?: string | null
  attachments?: SendMailOptions["attachments"]
  meta: EmailQueueMeta
}) {
  const db = await getDb()
  const now = new Date()

  const email = args.to ? String(args.to).trim() : ""
  if (!email || !email.includes("@")) {
    const inserted = await db.collection("EmailMessage").insertOne({
      to: args.to,
      subject: args.subject,
      text: args.text,
      meta: args.meta,
      status: "SKIPPED" as EmailMessageStatus,
      error: "Missing/invalid email",
      createdAt: now,
      sentAt: null,
    })
    return { ok: true as const, status: "SKIPPED" as const, id: inserted.insertedId.toString() }
  }

  const inserted = await db.collection("EmailMessage").insertOne({
    to: email,
    subject: args.subject,
    text: args.text,
    meta: args.meta,
    status: "PENDING" as EmailMessageStatus,
    error: null,
    createdAt: now,
    sentAt: null,
  })

  const id = inserted.insertedId
  const result = await sendEmail({
    to: email,
    subject: args.subject,
    text: args.text,
    html: args.html ?? null,
    attachments: args.attachments,
  })

  if (result.ok) {
    await db.collection("EmailMessage").updateOne(
      { _id: id },
      { $set: { status: "SENT" as EmailMessageStatus, sentAt: new Date(), providerMessageId: result.messageId ?? null } },
    )
    return { ok: true as const, status: "SENT" as const, id: id.toString() }
  }

  await db.collection("EmailMessage").updateOne(
    { _id: id },
    { $set: { status: "FAILED" as EmailMessageStatus, error: result.error, sentAt: new Date() } },
  )
  return { ok: false as const, status: "FAILED" as const, id: id.toString(), error: result.error }
}

export async function hasRecentAbsenceEmailAlert(args: { studentId: string; classId: string; absentCount: number; withinDays: number }) {
  const db = await getDb()
  const since = new Date()
  since.setDate(since.getDate() - args.withinDays)

  const existing = await db.collection("EmailMessage").findOne({
    createdAt: { $gte: since },
    "meta.kind": "ABSENCE_ALERT",
    "meta.studentId": args.studentId,
    "meta.classId": args.classId,
    "meta.absentCount": args.absentCount,
    status: { $in: ["SENT", "PENDING"] },
  })
  return Boolean(existing)
}
