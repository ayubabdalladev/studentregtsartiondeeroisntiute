"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Sidebar from "@/components/layout/sidebar"
import TopBar from "@/components/layout/topbar"

export default function AdminShell({
  role,
  children,
}: Readonly<{
  role: "ADMIN" | "TEACHER" | null
  children: React.ReactNode
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    setSidebarOpen(window.matchMedia("(min-width: 768px)").matches)
  }, [])

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex h-svh overflow-hidden bg-background text-foreground">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          role={role}
          onNavigate={() => setSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <TopBar
            sidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
            darkMode={darkMode}
            onDarkModeToggle={setDarkMode}
          />

          <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
        </div>
      </div>
    </div>
  )
}
