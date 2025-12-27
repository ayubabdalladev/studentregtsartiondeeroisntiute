import { getDb } from "@/lib/mongodb"
import { normalizeWhatsAppTo, sendWhatsAppText } from "@/lib/whatsapp"

export type WhatsAppMessageStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED"

export type WhatsAppQueueMeta =
  | { kind: "BROADCAST"; initiatedBy: string; classId: string; courseId?: string | null }
  | { kind: "ABSENCE_ALERT"; studentId: string; classId: string; absentCount: number; windowDays: number }

export type EnqueueWhatsAppMessageArgs = {
  to: string | null
  body: string
  meta: WhatsAppQueueMeta
}

export async function enqueueAndSendWhatsAppMessage(args: EnqueueWhatsAppMessageArgs) {
  const db = await getDb()
  const now = new Date()

  const normalized = args.to ? normalizeWhatsAppTo(args.to) : null
  if (!normalized) {
    const inserted = await db.collection("WhatsAppMessage").insertOne({
      to: args.to,
      body: args.body,
      meta: args.meta,
      status: "SKIPPED" as WhatsAppMessageStatus,
      error: "Missing/invalid phone",
      createdAt: now,
      sentAt: null,
    })
    return { ok: true as const, status: "SKIPPED" as const, id: inserted.insertedId.toString() }
  }

  const inserted = await db.collection("WhatsAppMessage").insertOne({
    to: normalized,
    body: args.body,
    meta: args.meta,
    status: "PENDING" as WhatsAppMessageStatus,
    error: null,
    createdAt: now,
    sentAt: null,
  })

  const id = inserted.insertedId
  const result = await sendWhatsAppText(normalized, args.body)

  if (result.ok) {
    await db.collection("WhatsAppMessage").updateOne(
      { _id: id },
      { $set: { status: "SENT" as WhatsAppMessageStatus, sentAt: new Date(), providerMessageId: result.messageId ?? null } },
    )
    return { ok: true as const, status: "SENT" as const, id: id.toString() }
  }

  await db.collection("WhatsAppMessage").updateOne(
    { _id: id },
    { $set: { status: "FAILED" as WhatsAppMessageStatus, error: result.error, errorStatus: result.status ?? null, sentAt: new Date() } },
  )
  return { ok: false as const, status: "FAILED" as const, id: id.toString(), error: result.error }
}

export async function hasRecentAbsenceAlert(args: { studentId: string; classId: string; absentCount: number; withinDays: number }) {
  const db = await getDb()
  const since = new Date()
  since.setDate(since.getDate() - args.withinDays)

  const existing = await db.collection("WhatsAppMessage").findOne({
    createdAt: { $gte: since },
    "meta.kind": "ABSENCE_ALERT",
    "meta.studentId": args.studentId,
    "meta.classId": args.classId,
    "meta.absentCount": args.absentCount,
    status: { $in: ["SENT", "PENDING"] },
  })
  return Boolean(existing)
}

