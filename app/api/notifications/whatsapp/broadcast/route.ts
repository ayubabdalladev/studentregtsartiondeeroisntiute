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

    const { message, classId, courseId } = body as { message?: unknown; classId?: unknown; courseId?: unknown }

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ message: "message is required" }, { status: 400 })
    }

    const db = await getDb()

    let resolvedClassId: string | null = null
    let resolvedCourseId: string | null = null

    if (typeof courseId === "string" && courseId) {
      const oid = toObjectId(courseId)
      if (!oid) return NextResponse.json({ message: "Invalid courseId" }, { status: 400 })
      const course = await db.collection("Course").findOne({ _id: oid }, { projection: { classId: 1 } })
      if (!course) return NextResponse.json({ message: "Course not found" }, { status: 404 })
      resolvedCourseId = courseId
      resolvedClassId = (course.classId as string | null | undefined) ?? null
    }

    if (!resolvedClassId && typeof classId === "string" && classId) {
      const oid = toObjectId(classId)
      if (!oid) return NextResponse.json({ message: "Invalid classId" }, { status: 400 })
      const cls = await db.collection("Class").findOne({ _id: oid }, { projection: { _id: 1 } })
      if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 })
      resolvedClassId = classId
    }

    if (!resolvedClassId) return NextResponse.json({ message: "classId or courseId is required" }, { status: 400 })

    const students = await db
      .collection("Student")
      .find({ classId: resolvedClassId, isActive: true })
      .project({ phone: 1, firstName: 1 })
      .toArray()

    const results = await Promise.all(
      students.map((s) => {
        const personalMessage = message.trim().replace(/\[\[name\]\]/g, (s.firstName as string) || "Student")
        return enqueueAndSendWhatsAppMessage({
          to: (s.phone as string | null | undefined) ?? null,
          body: personalMessage,
          meta: {
            kind: "BROADCAST",
            initiatedBy: session.userId,
            classId: resolvedClassId!,
            courseId: resolvedCourseId,
          },
        })
      }),
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
  } catch (error: any) {
    console.error("WhatsApp broadcast error:", error)
    return NextResponse.json({ message: error?.message || "Internal server error during broadcast" }, { status: 500 })
  }
}

