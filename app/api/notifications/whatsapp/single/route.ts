import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"
import { enqueueAndSendWhatsAppMessage } from "@/lib/whatsapp-queue"

function toObjectId(id: string) {
  try {
    return new ObjectId(id)
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequestCookies()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const body: unknown = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

    const { message, studentId } = body as { message?: unknown; studentId?: unknown }

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ message: "message is required" }, { status: 400 })
    }

    if (typeof studentId !== "string" || !studentId) {
      return NextResponse.json({ message: "studentId is required" }, { status: 400 })
    }

    const db = await getDb()
    const oid = toObjectId(studentId)
    if (!oid) return NextResponse.json({ message: "Invalid studentId" }, { status: 400 })

    const student = await db.collection("Student").findOne({ _id: oid }, { projection: { phone: 1, classId: 1, firstName: 1 } })
    if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

    const personalMessage = message.trim().replace(/\[\[name\]\]/g, (student.firstName as string) || "Student")

    const result = await enqueueAndSendWhatsAppMessage({
      to: (student.phone as string | null | undefined) ?? null,
      body: personalMessage,
      meta: {
        kind: "BROADCAST", // Reusing kind for general messages
        initiatedBy: session.userId,
        classId: student.classId ? student.classId.toString() : "unknown",
      },
    })

    if (!result.ok) {
      return NextResponse.json({
        message: result.error || "Failed to send WhatsApp",
        error: (result as any).error,
        status: (result as any).status
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      id: result.id
    })
  } catch (error: any) {
    console.error("WhatsApp single error:", error)
    return NextResponse.json({ 
      message: error?.message || "Internal server error during WhatsApp send",
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
    }, { status: 500 })
  }
}
