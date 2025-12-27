import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const limit = Math.min(Number(searchParams.get("limit") ?? 30) || 30, 100)

  const query: Record<string, unknown> = {}
  if (status) query.status = status

  const db = await getDb()
  const rows = await db
    .collection("EmailMessage")
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .project({ to: 1, subject: 1, status: 1, error: 1, createdAt: 1, sentAt: 1, providerMessageId: 1 })
    .toArray()

  return NextResponse.json(
    rows.map((r) => ({
      id: r._id.toString(),
      to: r.to ?? null,
      subject: r.subject ?? null,
      status: r.status ?? null,
      error: r.error ?? null,
      providerMessageId: r.providerMessageId ?? null,
      createdAt: r.createdAt ?? null,
      sentAt: r.sentAt ?? null,
    })),
  )
}

