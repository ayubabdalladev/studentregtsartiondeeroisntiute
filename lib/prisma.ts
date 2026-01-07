import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"

function toObjectId(id: string) {
  try {
    return new ObjectId(id)
  } catch {
    return null
  }
}

function normalizeId(doc: any) {
  if (!doc) return doc
  if (doc._id && !doc.id) return { ...doc, id: doc._id.toString(), _id: undefined }
  return doc
}

// Compatibility shim: this project previously used Prisma but Turbopack + Prisma MongoDB
// runtime can cause build-time module resolution failures. The app routes now use the
// MongoDB driver directly, but some older code may still import `{ prisma }` from here.
export const prisma = {
  user: {
    async findUnique(args: { where: { email?: string; id?: string } }) {
      const db = await getDb()
      if (args.where.email) return normalizeId(await db.collection("User").findOne({ email: args.where.email }))
      if (args.where.id) {
        const oid = toObjectId(args.where.id)
        if (!oid) return null
        return normalizeId(await db.collection("User").findOne({ _id: oid }))
      }
      return null
    },
  },
  class: {
    async findMany(args?: { orderBy?: { createdAt?: "asc" | "desc" }; include?: any }) {
      const db = await getDb()
      const sort = args?.orderBy?.createdAt ? ({ createdAt: args.orderBy.createdAt === "desc" ? -1 : 1 } as const) : null
      const cursor = db.collection("Class").find({})
      if (sort) cursor.sort(sort as any)
      const classes = await cursor.toArray()

      const normalized = classes.map(normalizeId)

      if (args?.include?.teacher) {
        const teacherIds = Array.from(
          new Set(
            normalized
              .map((c: any) => c.teacherId as string | null | undefined)
              .filter((id: any): id is string => Boolean(id)),
          ),
        )
        const teacherOids = teacherIds.map(toObjectId).filter((x): x is ObjectId => Boolean(x))
        const teachers = teacherOids.length
          ? await db.collection("User").find({ _id: { $in: teacherOids } }).project({ name: 1, email: 1 }).toArray()
          : []
        const teacherMap = new Map(teachers.map((t: any) => [t._id.toString(), normalizeId(t)]))
        for (const cls of normalized as any[]) {
          cls.teacher = cls.teacherId ? teacherMap.get(cls.teacherId) ?? null : null
        }
      }

      if (args?.include?._count?.select?.students) {
        const classIds = (normalized as any[]).map((c) => c.id)
        const counts = await db
          .collection("Student")
          .aggregate([
            { $match: { classId: { $in: classIds } } },
            { $group: { _id: "$classId", count: { $sum: 1 } } },
          ])
          .toArray()
        const countMap = new Map(counts.map((r: any) => [r._id, r.count]))
        for (const cls of normalized as any[]) {
          cls._count = { students: countMap.get(cls.id) ?? 0 }
        }
      }

      return normalized
    },
    async create(args: { data: any; include?: any }) {
      const db = await getDb()
      const now = new Date()
      const doc = { ...args.data, createdAt: now, updatedAt: now }
      const inserted = await db.collection("Class").insertOne(doc)
      const created = normalizeId({ ...doc, _id: inserted.insertedId })

      if (args.include?.teacher) {
        const tid = created.teacherId as string | null | undefined
        if (tid) {
          const oid = toObjectId(tid)
          created.teacher = oid
            ? normalizeId(await db.collection("User").findOne({ _id: oid }, { projection: { name: 1, email: 1 } }))
            : null
        } else {
          created.teacher = null
        }
      }
      if (args.include?._count?.select?.students) created._count = { students: 0 }
      return created
    },
    async findUnique(args: { where: { id: string }; include?: any }) {
      const db = await getDb()
      const oid = toObjectId(args.where.id)
      if (!oid) return null
      const cls = normalizeId(await db.collection("Class").findOne({ _id: oid }))
      if (!cls) return null

      if (args.include?.teacher) {
        const tid = cls.teacherId as string | null | undefined
        const toid = tid ? toObjectId(tid) : null
        cls.teacher = toid
          ? normalizeId(await db.collection("User").findOne({ _id: toid }, { projection: { name: 1, email: 1 } }))
          : null
      }

      if (args.include?.students) {
        cls.students = await db.collection("Student").find({ classId: cls.id }).toArray()
      }

      return cls
    },
    async update(args: { where: { id: string }; data: any }) {
      const db = await getDb()
      const oid = toObjectId(args.where.id)
      if (!oid) throw new Error("Invalid id")
      const updated = await db.collection("Class").findOneAndUpdate(
        { _id: oid },
        { $set: { ...args.data, updatedAt: new Date() } },
        { returnDocument: "after" },
      )
      return updated ? normalizeId(updated) : null
    },
    async delete(args: { where: { id: string } }) {
      const db = await getDb()
      const oid = toObjectId(args.where.id)
      if (!oid) throw new Error("Invalid id")
      await db.collection("Class").deleteOne({ _id: oid })
      return { ok: true }
    },
  },
  student: {
    async findMany(args?: { orderBy?: { createdAt?: "asc" | "desc" }; include?: any }) {
      const db = await getDb()
      const sort = args?.orderBy?.createdAt ? ({ createdAt: args.orderBy.createdAt === "desc" ? -1 : 1 } as const) : null
      const cursor = db.collection("Student").find({})
      if (sort) cursor.sort(sort as any)
      const students = await cursor.toArray()
      const normalized = students.map(normalizeId)

      if (args?.include?.class) {
        const classIds = Array.from(
          new Set(
            normalized
              .map((s: any) => s.classId as string | null | undefined)
              .filter((id: any): id is string => Boolean(id)),
          ),
        )
        const classOids = classIds.map(toObjectId).filter((x): x is ObjectId => Boolean(x))
        const classes = classOids.length
          ? await db.collection("Class").find({ _id: { $in: classOids } }).project({ name: 1, level: 1, isActive: 1 }).toArray()
          : []
        const classMap = new Map(classes.map((c: any) => [c._id.toString(), normalizeId(c)]))
        for (const s of normalized as any[]) {
          s.class = s.classId ? classMap.get(s.classId) ?? null : null
        }
      }

      return normalized
    },
    async create(args: { data: any }) {
      const db = await getDb()
      const now = new Date()
      const doc = { ...args.data, createdAt: now, updatedAt: now }
      const inserted = await db.collection("Student").insertOne(doc)
      return normalizeId({ ...doc, _id: inserted.insertedId })
    },
    async findUnique(args: { where: { id: string }; include?: any }) {
      const db = await getDb()
      const oid = toObjectId(args.where.id)
      if (!oid) return null
      const student = normalizeId(await db.collection("Student").findOne({ _id: oid }))
      if (!student) return null

      if (args.include?.class && student.classId) {
        const coid = toObjectId(student.classId)
        student.class = coid ? normalizeId(await db.collection("Class").findOne({ _id: coid })) : null
      }
      if (args.include?.payments) {
        student.payments = await db.collection("Payment").find({ studentId: student.id }).toArray()
      }
      if (args.include?.attendances) {
        student.attendances = await db.collection("Attendance").find({ studentId: student.id }).toArray()
      }

      return student
    },
    async update(args: { where: { id: string }; data: any }) {
      const db = await getDb()
      const oid = toObjectId(args.where.id)
      if (!oid) throw new Error("Invalid id")
      const updated = await db.collection("Student").findOneAndUpdate(
        { _id: oid },
        { $set: { ...args.data, updatedAt: new Date() } },
        { returnDocument: "after" },
      )
      return updated ? normalizeId(updated) : null
    },
    async delete(args: { where: { id: string } }) {
      const db = await getDb()
      const oid = toObjectId(args.where.id)
      if (!oid) throw new Error("Invalid id")
      await db.collection("Student").deleteOne({ _id: oid })
      return { ok: true }
    },
  },
  attendance: {
    async createMany(args: { data: any[] }) {
      const db = await getDb()
      const created = await db.collection("Attendance").insertMany(args.data)
      return { count: created.insertedCount }
    },
  },
} as const
