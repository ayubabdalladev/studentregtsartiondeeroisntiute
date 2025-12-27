"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { Menu, Moon, Sun, Bell, Settings, User } from "lucide-react"

interface TopBarProps {
  sidebarOpen: boolean
  onSidebarToggle: (open: boolean) => void
  darkMode: boolean
  onDarkModeToggle: (mode: boolean) => void
  title?: string
}

export default function TopBar({ sidebarOpen, onSidebarToggle, darkMode, onDarkModeToggle, title }: TopBarProps) {
  const pathname = usePathname()
  const derivedTitle = useMemo(() => {
    if (title) return title
    if (pathname.startsWith("/classes")) return "Classes"
    if (pathname.startsWith("/students")) return "Students"
    if (pathname.startsWith("/teachers")) return "Teachers"
    if (pathname.startsWith("/courses")) return "Courses"
    if (pathname.startsWith("/payments")) return "Payments"
    if (pathname.startsWith("/reports")) return "Reports"
    if (pathname.startsWith("/messages")) return "Messages"
    return "Admin Dashboard"
  }, [pathname, title])

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
      {/* Left Side */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={() => onSidebarToggle(!sidebarOpen)}
          className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base sm:text-xl font-semibold text-foreground truncate">{derivedTitle}</h2>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onDarkModeToggle(!darkMode)}
          className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors"
        >
          {darkMode ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5" />}
        </button>

        <button className="p-1.5 sm:p-2 hover:bg-muted rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </button>

        <button className="hidden sm:inline-flex p-2 hover:bg-muted rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        <button className="hidden sm:inline-flex p-2 hover:bg-muted rounded-lg transition-colors">
          <User className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
