import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"
import { getSessionFromRequestCookies } from "@/lib/auth"

type PaymentRow = {
  id: string
  amount: number
  currency: string
  paidAt: string
  note: string | null
  student: {
    id: string
    firstName: string
    lastName: string
    class: { id: string; name: string; level: string | null } | null
  } | null
}

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200)

  const payments = await db.collection("Payment").find({}).sort({ paidAt: -1 }).limit(limit).toArray()
  const studentIds = Array.from(
    new Set(payments.map((p) => (p.studentId as string | null | undefined) ?? null).filter((x): x is string => Boolean(x))),
  )

  const studentObjectIds = studentIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  const students = studentObjectIds.length
    ? await db
        .collection("Student")
        .find({ _id: { $in: studentObjectIds } })
        .project({ firstName: 1, lastName: 1, classId: 1 })
        .toArray()
    : []

  const classIds = Array.from(
    new Set(students.map((s) => (s.classId as string | null | undefined) ?? null).filter((x): x is string => Boolean(x))),
  )

  const classObjectIds = classIds
    .map((id) => {
      try {
        return new ObjectId(id)
      } catch {
        return null
      }
    })
    .filter((id): id is ObjectId => Boolean(id))

  const classes = classObjectIds.length
    ? await db.collection("Class").find({ _id: { $in: classObjectIds } }).project({ name: 1, level: 1 }).toArray()
    : []

  const classMap = new Map<string, { id: string; name: string; level: string | null }>(
    classes.map((c) => [c._id.toString(), { id: c._id.toString(), name: c.name, level: c.level ?? null }]),
  )

  const studentMap = new Map<string, { id: string; firstName: string; lastName: string; class: { id: string; name: string; level: string | null } | null }>(
    students.map((s) => {
      const id = s._id.toString()
      const clsId = (s.classId as string | null | undefined) ?? null
      return [id, { id, firstName: s.firstName, lastName: s.lastName, class: clsId ? classMap.get(clsId) ?? null : null }]
    }),
  )

  const rows: PaymentRow[] = payments.map((p) => {
    const id = p._id.toString()
    const studentId = (p.studentId as string | null | undefined) ?? null
    return {
      id,
      amount: Number(p.amount ?? 0),
      currency: (p.currency as string | null | undefined) ?? "USD",
      paidAt: (p.paidAt ? new Date(p.paidAt).toISOString() : new Date(p.createdAt ?? Date.now()).toISOString()),
      note: (p.note as string | null | undefined) ?? null,
      student: studentId ? studentMap.get(studentId) ?? null : null,
    }
  })

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies()
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body: unknown = await req.json()
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 })

  const { studentId, amount, currency, note, paidAt } = body as {
    studentId?: unknown
    amount?: unknown
    currency?: unknown
    note?: unknown
    paidAt?: unknown
  }

  if (typeof studentId !== "string" || !studentId) {
    return NextResponse.json({ message: "studentId is required" }, { status: 400 })
  }
  let studentObjectId: ObjectId
  try {
    studentObjectId = new ObjectId(studentId)
  } catch {
    return NextResponse.json({ message: "Invalid studentId" }, { status: 400 })
  }

  const numericAmount = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ message: "amount must be a positive number" }, { status: 400 })
  }

  const parsedPaidAt = typeof paidAt === "string" ? new Date(paidAt) : paidAt instanceof Date ? paidAt : new Date()
  if (Number.isNaN(parsedPaidAt.getTime())) return NextResponse.json({ message: "Invalid paidAt" }, { status: 400 })

  const paymentCurrency = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD"
  const paymentNote = typeof note === "string" && note.trim() ? note.trim() : null

  const db = await getDb()
  const student = await db.collection("Student").findOne({ _id: studentObjectId }, { projection: { _id: 1 } })
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 })

  const createdAt = new Date()
  const inserted = await db.collection("Payment").insertOne({
    studentId,
    amount: numericAmount,
    currency: paymentCurrency,
    note: paymentNote,
    paidAt: parsedPaidAt,
    createdAt,
  })

  await db.collection("Student").updateOne({ _id: studentObjectId }, { $set: { paymentStatus: "PAID", updatedAt: new Date() } })

  return NextResponse.json(
    {
      id: inserted.insertedId.toString(),
      studentId,
      amount: numericAmount,
      currency: paymentCurrency,
      note: paymentNote,
      paidAt: parsedPaidAt.toISOString(),
    },
    { status: 201 },
  )
}

