import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";

// GET /api/teachers (ADMIN)
export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const teachers = await db
    .collection("User")
    .find({ role: "TEACHER", ...(includeInactive ? {} : { isActive: true }) })
    .project({ name: 1, email: 1, isActive: 1 })
    .sort({ name: 1 })
    .toArray();

  const teacherIds = teachers.map((t) => t._id.toString());
  const classRows = teacherIds.length
    ? await db
        .collection("Class")
        .find({ teacherId: { $in: teacherIds } })
        .project({ name: 1, level: 1, teacherId: 1 })
        .toArray()
    : [];

  const classesByTeacher = new Map<string, Array<{ id: string; name: string; level: string | null }>>();
  for (const cls of classRows) {
    const tid = cls.teacherId as string | null | undefined;
    if (!tid) continue;
    const list = classesByTeacher.get(tid) ?? [];
    list.push({ id: cls._id.toString(), name: cls.name, level: cls.level ?? null });
    classesByTeacher.set(tid, list);
  }

  return NextResponse.json(
    teachers.map((t) => {
      const id = t._id.toString();
      const classes = classesByTeacher.get(id) ?? [];
      return {
        id,
        name: t.name,
        email: t.email,
        isActive: Boolean(t.isActive),
        classes,
      };
    }),
  );
}

// POST /api/teachers (ADMIN)
export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body: unknown = await req.json();
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid body" }, { status: 400 });

  const { name, email, password, classIds } = body as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    classIds?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ message: "Name is required" }, { status: 400 });
  if (typeof email !== "string" || !email.trim()) return NextResponse.json({ message: "Email is required" }, { status: 400 });
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  const existing = await db.collection("User").findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
  if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const inserted = await db.collection("User").insertOne({
    name: name.trim(),
    email: normalizedEmail,
    password: passwordHash,
    role: "TEACHER",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const teacherId = inserted.insertedId.toString();
  const ids = Array.isArray(classIds) ? (classIds.filter((x) => typeof x === "string") as string[]) : [];
  if (ids.length) {
    const objectIds = ids
      .map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is ObjectId => Boolean(id));

    if (objectIds.length) {
      await db.collection("Class").updateMany({ _id: { $in: objectIds } }, { $set: { teacherId, updatedAt: new Date() } });
    }
  }

  return NextResponse.json({ id: teacherId, name: name.trim(), email: normalizedEmail, isActive: true, classes: [] }, { status: 201 });
}
