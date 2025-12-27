import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getJwtSecret() {
  const value = process.env.JWT_SECRET
  if (!value) return null
  return new TextEncoder().encode(value)
}

// Route rules
const ADMIN_ONLY = [
  "/dashboard",
  "/students",
  "/teachers",
  "/courses",
  "/classes",
  "/attendance-management",
  "/payments",
  "/reports",
  "/messages",
];

const TEACHER_ONLY = [
  "/attendance",
];

function matchesPathPrefix(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const pathname = req.nextUrl.pathname;

  // Allow login page
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // Block unauthenticated users
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const secret = getJwtSecret()
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=server_config", req.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as "ADMIN" | "TEACHER";

    // Admin-only routes
    if (
      ADMIN_ONLY.some((path) => matchesPathPrefix(pathname, path)) &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Teacher-only routes
    if (
      TEACHER_ONLY.some((path) => matchesPathPrefix(pathname, path)) &&
      role !== "TEACHER"
    ) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/students/:path*",
    "/teachers/:path*",
    "/courses/:path*",
    "/classes/:path*",
    "/attendance/:path*",
    "/attendance-management/:path*",
    "/payments/:path*",
    "/reports/:path*",
    "/messages/:path*",
  ],
};
