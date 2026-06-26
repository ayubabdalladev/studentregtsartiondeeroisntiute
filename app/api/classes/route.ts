import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { buildIdFilter, buildIdFilterList } from "@/lib/mongo-id";

async function validateShiftId(db: Awaited<ReturnType<typeof getDb>>, shiftId: string | null) {
  if (!shiftId) return null;
  const shift = await db
    .collection("Shift")
    .findOne(buildIdFilter(shiftId), { projection: { name: 1, startTime: 1, endTime: 1, isActive: 1 } });
  if (!shift || !shift.isActive) {
    return { error: NextResponse.json({ message: "Shift not found" }, { status: 400 }) };
  }
  return {
    shift: {
      id: shift._id.toString(),
      name: shift.name,
      startTime: shift.startTime ?? null,
      endTime: shift.endTime ?? null,
      isActive: Boolean(shift.isActive),
    },
  };
}

function mapClassRow(
  cls: {
    _id: { toString(): string };
    name: string;
    level?: string | null;
    isActive?: boolean;
    teacherId?: string | null;
    shiftId?: string | null;
  },
  countMap: Map<string, number>,
  teacherMap: Map<string, { id: string; name: string; email: string }>,
  shiftMap: Map<string, { id: string; name: string; startTime: string | null; endTime: string | null; isActive: boolean }>,
) {
  const id = cls._id.toString();
  const tid = (cls.teacherId as string | null | undefined) ?? null;
  const sid = (cls.shiftId as string | null | undefined) ?? null;
  return {
    id,
    name: cls.name,
    level: cls.level ?? null,
    isActive: Boolean(cls.isActive),
    teacherId: tid,
    teacher: tid ? teacherMap.get(tid) ?? null : null,
    shiftId: sid,
    shift: sid ? shiftMap.get(sid) ?? null : null,
    studentsCount: countMap.get(id) ?? 0,
  };
}

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

  const shiftIdStrings = Array.from(
    new Set(
      classes
        .map((c) => c.shiftId as string | null | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const shiftFilter = buildIdFilterList(shiftIdStrings);
  const shifts = shiftFilter
    ? await db.collection("Shift").find(shiftFilter).project({ name: 1, startTime: 1, endTime: 1, isActive: 1 }).toArray()
    : [];

  const shiftMap = new Map<string, { id: string; name: string; startTime: string | null; endTime: string | null; isActive: boolean }>(
    shifts.map((s) => [
      String(s._id),
      {
        id: String(s._id),
        name: s.name,
        startTime: s.startTime ?? null,
        endTime: s.endTime ?? null,
        isActive: Boolean(s.isActive),
      },
    ]),
  );

  return NextResponse.json(classes.map((cls) => mapClassRow(cls, countMap, teacherMap, shiftMap)));
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

  const shiftId = body.shiftId ?? null;
  const shiftResult = await validateShiftId(db, shiftId);
  if (shiftResult && "error" in shiftResult) return shiftResult.error;

  const now = new Date();
  const inserted = await db.collection("Class").insertOne({
    name: body.name,
    level: body.level ?? null,
    teacherId,
    shiftId,
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
      shiftId,
      shift: shiftResult?.shift ?? null,
      studentsCount: 0,
    },
    { status: 201 },
  );
}
