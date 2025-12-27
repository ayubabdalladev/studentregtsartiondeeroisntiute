import { cookies } from "next/headers"
import { jwtVerify } from "jose"

export type AppRole = "ADMIN" | "TEACHER"

export type AppSession = {
  userId: string
  role: AppRole
}

export async function getSessionFromRequestCookies(): Promise<AppSession | null> {
  const token = (await cookies()).get("token")?.value
  if (!token) return null

  const secret = process.env.JWT_SECRET
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    const role = payload.role
    const userId = typeof payload.sub === "string" ? payload.sub : null
    if (!userId) return null

    if (role === "ADMIN" || role === "TEACHER") return { userId, role }
    return null
  } catch {
    return null
  }
}

export async function getRoleFromRequestCookies(): Promise<AppRole | null> {
  const token = (await cookies()).get("token")?.value
  if (!token) return null

  const secret = process.env.JWT_SECRET
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    const role = payload.role
    if (role === "ADMIN" || role === "TEACHER") return role
    return null
  } catch {
    return null
  }
}
