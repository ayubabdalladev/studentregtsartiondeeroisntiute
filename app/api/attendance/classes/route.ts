import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

export async function GET() {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "TEACHER") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const db = await getDb()
  const classes = await db
    .collection("Class")
    .find({ teacherId: session.userId, isActive: true })
    .project({ name: 1, level: 1, isActive: 1 })
    .sort({ name: 1 })
    .toArray()

  const classIds = classes.map((c) => c._id.toString())
  const counts = classIds.length
    ? await db
        .collection("Student")
        .aggregate([
          { $match: { classId: { $in: classIds }, isActive: true } },
          { $group: { _id: "$classId", count: { $sum: 1 } } },
        ])
        .toArray()
    : []

  const countMap = new Map<string, number>(counts.map((r) => [r._id as string, r.count as number]))

  return NextResponse.json(
    classes.map((c) => {
      const id = c._id.toString()
      return {
        id,
        name: c.name,
        level: c.level ?? null,
        isActive: Boolean(c.isActive),
        studentsCount: countMap.get(id) ?? 0,
      }
    }),
  )
}

