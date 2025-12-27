import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getDb } from "@/lib/mongodb";

export async function POST(req: Request) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    return NextResponse.json({ message: "Server misconfigured" }, { status: 500 })
  }
  const secret = new TextEncoder().encode(jwtSecret)

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ message: "Email & password required" }, { status: 400 });
  }

  const db = await getDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await db.collection("User").findOne({ email: normalizedEmail });

  if (!user || !user.isActive) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password as string);
  if (!ok) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });

  const token = await new SignJWT({ sub: user._id.toString(), role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const res = NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  });

  res.cookies.set("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res;
}
