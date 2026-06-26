import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { buildIdFilter } from "@/lib/mongo-id";

type RouteContext = { params: Promise<{ id: string }> };

function serializeShift(doc: {
  _id: { toString(): string };
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  isActive?: boolean;
}) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    startTime: doc.startTime ?? null,
    endTime: doc.endTime ?? null,
    isActive: Boolean(doc.isActive),
  };
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "Shift name is required" }, { status: 400 });
  }

  const startTime = typeof body.startTime === "string" && body.startTime.trim() ? body.startTime.trim() : null;
  const endTime = typeof body.endTime === "string" && body.endTime.trim() ? body.endTime.trim() : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : Boolean(body.isActive);

  const db = await getDb();
  const existing = await db.collection("Shift").findOne({ name }, { projection: { _id: 1 } });
  if (existing && existing._id.toString() !== id) {
    return NextResponse.json({ message: "A shift with this name already exists" }, { status: 409 });
  }

  const updated = await db.collection("Shift").findOneAndUpdate(
    buildIdFilter(id),
    {
      $set: {
        name,
        startTime,
        endTime,
        isActive,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    return NextResponse.json({ message: "Shift not found" }, { status: 404 });
  }

  return NextResponse.json(serializeShift(updated));
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const shiftId = id;
  const inUse = await db.collection("Class").findOne({ shiftId }, { projection: { _id: 1 } });
  if (inUse) {
    return NextResponse.json(
      { message: "Cannot delete shift while classes are assigned to it" },
      { status: 409 },
    );
  }

  const deleted = await db.collection("Shift").findOneAndDelete(buildIdFilter(id));
  if (!deleted) {
    return NextResponse.json({ message: "Shift not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
