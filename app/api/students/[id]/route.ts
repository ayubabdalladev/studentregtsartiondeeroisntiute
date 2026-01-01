import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { buildIdFilter } from "@/lib/mongo-id";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const studentFilter = buildIdFilter(id);
  const student = await db.collection("Student").findOne(studentFilter);
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  const classId = (student.classId as string | null | undefined) ?? null;
  const cls =
    classId &&
    (await db
      .collection("Class")
      .findOne(buildIdFilter(classId), { projection: { name: 1, level: 1, isActive: 1 } })
      .then((c) => (c ? { id: c._id.toString(), name: c.name, level: c.level ?? null, isActive: Boolean(c.isActive) } : null))
      .catch(() => null));

  const studentId = String(student._id);
  const payments = await db.collection("Payment").find({ studentId }).sort({ paidAt: -1 }).toArray();
  const attendances = await db.collection("Attendance").find({ studentId }).sort({ date: -1 }).toArray();

  return NextResponse.json({
    id: studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    phone: student.phone ?? null,
    email: student.email ?? null,
    gender: student.gender ?? null,
    paymentStatus: student.paymentStatus ?? "UNPAID",
    isActive: Boolean(student.isActive),
    classId,
    class: cls ?? null,
    payments,
    attendances,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const db = await getDb();

  const classId = (body.classId as string | null | undefined) ?? null;
  if (classId) {
    const cls = await db.collection("Class").findOne(buildIdFilter(classId), { projection: { _id: 1 } });
    if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 400 });
  }

  const paymentStatus = body.paymentStatus ?? "UNPAID";
  if (paymentStatus !== "PAID" && paymentStatus !== "UNPAID") {
    return NextResponse.json({ message: "Invalid paymentStatus" }, { status: 400 });
  }

  const studentFilter = buildIdFilter(id);

  const updated = await db.collection("Student").findOneAndUpdate(
    studentFilter,
    {
      $set: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? null,
        email: body.email ?? null,
        gender: body.gender ?? null,
        paymentStatus,
        classId,
        isActive: typeof body.isActive === "boolean" ? body.isActive : Boolean(body.isActive),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  const value = updated?.value;
  if (!value) return NextResponse.json({ message: "Student not found" }, { status: 404 });
  return NextResponse.json({ id: value._id.toString(), ...value, _id: undefined });
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const studentFilter = buildIdFilter(id);
  const deleted = await db.collection("Student").findOneAndDelete(studentFilter);
  const student = deleted?.value;
  if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

  const studentId = String(student._id);

  await Promise.all([
    db.collection("Payment").deleteMany({ studentId }),
    db.collection("Attendance").deleteMany({ studentId }),
  ]);

  return NextResponse.json({ ok: true });
}
