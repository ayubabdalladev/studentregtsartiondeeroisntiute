"use client"

import { useRouter } from "next/navigation"
import LoginPage from "@/components/auth/login-page"

export default function LoginRoutePage() {
  const router = useRouter()

  return (
    <LoginPage
      onLogin={(role) => {
        router.replace(role === "TEACHER" ? "/attendance" : "/dashboard")
      }}
    />
  )
}
