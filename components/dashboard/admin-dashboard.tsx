"use client"

import { useState } from "react"
import Sidebar from "@/components/layout/sidebar"
import TopBar from "@/components/layout/topbar"
import DashboardContent from "@/components/dashboard/dashboard-content"

interface AdminDashboardProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  darkMode: boolean
  setDarkMode: (mode: boolean) => void
}

export default function AdminDashboard({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode }: AdminDashboardProps) {
  const [currentSection, setCurrentSection] = useState("dashboard")

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        role="ADMIN"
        onNavigate={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar
          sidebarOpen={sidebarOpen}
          onSidebarToggle={setSidebarOpen}
          darkMode={darkMode}
          onDarkModeToggle={setDarkMode}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-muted/30">
          <DashboardContent currentSection={currentSection} />
        </main>
      </div>
    </div>
  )
}
