import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { buildIdFilter } from "@/lib/mongo-id";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const cls = await db.collection("Class").findOne(buildIdFilter(id));

  if (!cls) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const teacherId = (cls.teacherId as string | null | undefined) ?? null;
  let teacher: { id: string; name: string; email: string } | null = null;
  if (teacherId) {
    try {
      const t = await db
        .collection("User")
        .findOne(buildIdFilter(teacherId), { projection: { name: 1, email: 1 } });
      teacher = t ? { id: t._id.toString(), name: t.name, email: t.email } : null;
    } catch {
      teacher = null;
    }
  }

  const students = await db
    .collection("Student")
    .find({ classId: cls._id.toString() })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    id: cls._id.toString(),
    name: cls.name,
    level: cls.level ?? null,
    isActive: Boolean(cls.isActive),
    teacherId,
    teacher: teacher ?? null,
    students,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const teacherId = body.teacherId ?? null;
  if (teacherId) {
    if (typeof teacherId !== "string") return NextResponse.json({ message: "Invalid teacherId" }, { status: 400 });
  }

  const db = await getDb();
  if (teacherId) {
    const teacher = await db
      .collection("User")
      .findOne(buildIdFilter(teacherId), { projection: { role: 1, isActive: 1 } });
    if (!teacher || !teacher.isActive || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "Teacher not found" }, { status: 400 });
    }
  }
  const updated = await db.collection("Class").findOneAndUpdate(
    buildIdFilter(id),
    {
      $set: {
        name: body.name,
        level: body.level ?? null,
        teacherId,
        isActive: typeof body.isActive === "boolean" ? body.isActive : Boolean(body.isActive),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated._id.toString(),
    name: updated.name,
    level: updated.level ?? null,
    isActive: Boolean(updated.isActive),
    teacherId,
  });
}

export async function DELETE(
  _: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const cls = await db.collection("Class").findOneAndDelete(buildIdFilter(id));
  if (!cls) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const classId = String(cls._id);
  await db.collection("Student").updateMany({ classId }, { $set: { classId: null, updatedAt: new Date() } });
  await db.collection("Course").deleteMany({ classId });

  return NextResponse.json({ ok: true });
}
