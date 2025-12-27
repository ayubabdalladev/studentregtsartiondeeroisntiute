"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, BookOpen, DollarSign, FileText, School, ChevronRight, LogOut, Calendar, Mail } from "lucide-react"
import { api } from "@/lib/api"

interface SidebarProps {
  isOpen: boolean
  role?: "ADMIN" | "TEACHER" | null
  onNavigate?: () => void
}

const adminMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/classes", label: "Classes", icon: School },
  { href: "/attendance-management", label: "Attendance", icon: Calendar },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/messages", label: "Messages", icon: Mail },
]

export default function Sidebar({ isOpen, role, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const menuItems =
    role === "ADMIN"
      ? adminMenuItems
      : role === "TEACHER"
        ? [{ href: "/attendance", label: "Attendance", icon: Calendar }]
        : []

  return (
    <aside
      className={`w-64 ${isOpen ? "md:w-64" : "md:w-20"} bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col h-svh md:h-screen fixed md:static inset-y-0 left-0 z-50 md:z-auto transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* Logo Section */}
      <div className="p-4 border-b border-sidebar-border">
        <img
          src="/main logo-01.png"
          alt="School Management Logo"
          className="w-full max-h-20 object-contain mx-auto"
          style={{ display: 'block' }}
        />
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
              title={!isOpen ? item.label : ""}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout Button */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={async () => {
            try {
              await api.post("/api/auth/logout")
            } finally {
              window.location.href = "/login"
            }
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
