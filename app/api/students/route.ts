import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const paymentStatus = searchParams.get("paymentStatus");
  const isActive = searchParams.get("isActive");

  const query: Record<string, unknown> = {};
  if (classId) {
    try {
      new ObjectId(classId);
    } catch {
      return NextResponse.json({ message: "Invalid classId" }, { status: 400 });
    }
    query.classId = classId;
  }
  if (paymentStatus) {
    if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
      return NextResponse.json({ message: "Invalid paymentStatus" }, { status: 400 });
    }
    query.paymentStatus = paymentStatus;
  }
  if (isActive === "true") query.isActive = true;
  if (isActive === "false") query.isActive = false;

  const students = await db
    .collection("Student")
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  const classIds = Array.from(
    new Set(
      students
        .map((s) => s.classId as string | null | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const classObjectIds = classIds
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter((id): id is ObjectId => Boolean(id));

  const classes = classObjectIds.length
    ? await db
        .collection("Class")
        .find({ _id: { $in: classObjectIds } })
        .project({ name: 1, level: 1, isActive: 1 })
        .toArray()
    : [];

  const classMap = new Map<string, any>(classes.map((c) => [c._id.toString(), c]));

  return NextResponse.json(
    students.map((s) => {
      const id = s._id.toString();
      const classId = (s.classId as string | null | undefined) ?? null;
      const cls = classId ? classMap.get(classId) : null;
      return {
        id,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone ?? null,
        email: s.email ?? null,
        gender: s.gender ?? null,
        paymentStatus: s.paymentStatus ?? "UNPAID",
        isActive: Boolean(s.isActive),
        classId,
        class: cls
          ? { id: cls._id.toString(), name: cls.name, level: cls.level ?? null, isActive: Boolean(cls.isActive) }
          : null,
        createdAt: s.createdAt ?? null,
        updatedAt: s.updatedAt ?? null,
      };
    }),
  );
}

export async function POST(req: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const db = await getDb();

  const classId = (body.classId as string | null | undefined) ?? null;
  if (classId) {
    try {
      new ObjectId(classId);
    } catch {
      return NextResponse.json({ message: "Invalid classId" }, { status: 400 });
    }
    const cls = await db.collection("Class").findOne({ _id: new ObjectId(classId) }, { projection: { _id: 1 } });
    if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 400 });
  }

  const paymentStatus = body.paymentStatus ?? "UNPAID";
  if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
    return NextResponse.json({ message: "Invalid paymentStatus" }, { status: 400 });
  }

  const now = new Date();
  const inserted = await db.collection("Student").insertOne({
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone ?? null,
    email: body.email ?? null,
    gender: body.gender ?? null,
    paymentStatus,
    isActive: true,
    classId,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: inserted.insertedId.toString(), ...body }, { status: 201 });
}
