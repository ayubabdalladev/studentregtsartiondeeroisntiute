import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { buildIdFilter, buildIdFilterList } from "@/lib/mongo-id";

// GET /api/classes
export async function GET() {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();

  const classes = await db
    .collection("Class")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  const classIds = classes.map((c) => c._id.toString());

  const counts = await db
    .collection("Student")
    .aggregate([
      { $match: { classId: { $in: classIds } } },
      { $group: { _id: "$classId", count: { $sum: 1 } } },
    ])
    .toArray();

  const countMap = new Map<string, number>(counts.map((r) => [r._id as string, r.count as number]));

  const teacherIdStrings = Array.from(
    new Set(
      classes
        .map((c) => c.teacherId as string | null | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const teacherFilter = buildIdFilterList(teacherIdStrings);

  const teachers = teacherFilter
    ? await db.collection("User").find(teacherFilter).project({ name: 1, email: 1 }).toArray()
    : [];

  const teacherMap = new Map<string, { id: string; name: string; email: string }>(
    teachers.map((t) => [String(t._id), { id: String(t._id), name: t.name, email: t.email }]),
  );

  return NextResponse.json(
    classes.map((cls) => {
      const id = cls._id.toString();
      const tid = (cls.teacherId as string | null | undefined) ?? null;
      return {
        id,
        name: cls.name,
        level: cls.level ?? null,
        isActive: Boolean(cls.isActive),
        teacherId: tid,
        teacher: tid ? teacherMap.get(tid) ?? null : null,
        studentsCount: countMap.get(id) ?? 0,
      };
    }),
  );
}

// POST /api/classes
export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (!body.name) {
    return NextResponse.json(
      { message: "Class name is required" },
      { status: 400 }
    );
  }

  const db = await getDb();

  const teacherId = body.teacherId ?? null;
  if (teacherId) {
    const teacher = await db
      .collection("User")
      .findOne(buildIdFilter(teacherId), { projection: { role: 1, isActive: 1 } });
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 });
    }
  }

  const now = new Date();
  const inserted = await db.collection("Class").insertOne({
    name: body.name,
    level: body.level ?? null,
    teacherId,
    isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      id: inserted.insertedId.toString(),
      name: body.name,
      level: body.level ?? null,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      teacherId,
      teacher: null,
      studentsCount: 0,
    },
    { status: 201 },
  );
}
