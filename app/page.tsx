"use client"

import { useEffect, useState } from "react"
import LoginPage from "@/components/auth/login-page"
import AdminDashboard from "@/components/dashboard/admin-dashboard"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    setSidebarOpen(window.matchMedia("(min-width: 768px)").matches)
  }, [])

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground">
        <AdminDashboard
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      </div>
    </div>
  )
}
