"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Users, BookOpen, Calendar, DollarSign } from "lucide-react"
import { api } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"

type ReportsSummary = {
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  attendanceRate: number
  paidStudents: number
  unpaidStudents: number
  monthlyRevenue: number
  weeklyAttendance: Array<{ label: string; present: number; absent: number }>
  enrollmentTrends: Array<{ label: string; value: number }>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default function DashboardMetrics() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<ReportsSummary>("/api/reports/summary")
        setSummary(res.data)
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? "Failed to load dashboard data.")
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const metrics = useMemo(() => {
    return [
      { label: "Total Students", value: summary ? String(summary.totalStudents) : "—", icon: Users, color: "bg-chart-1" },
      { label: "Total Classes", value: summary ? String(summary.totalClasses) : "—", icon: BookOpen, color: "bg-chart-2" },
      {
        label: "Attendance Rate",
        value: summary ? `${summary.attendanceRate.toFixed(1)}%` : "—",
        icon: Calendar,
        color: "bg-chart-3",
      },
      {
        label: "Monthly Revenue",
        value: summary ? formatCurrency(summary.monthlyRevenue) : "—",
        icon: DollarSign,
        color: "bg-chart-4",
      },
    ]
  }, [summary])

  const enrollmentData = useMemo(() => {
    return (summary?.enrollmentTrends ?? []).map((p) => ({ month: p.label, students: p.value }))
  }, [summary])

  const attendanceData = useMemo(() => {
    return (summary?.weeklyAttendance ?? []).map((p) => ({ date: p.label, present: p.present, absent: p.absent }))
  }, [summary])

  const paymentData = useMemo(() => {
    return [
      { name: "Paid", value: summary?.paidStudents ?? 0 },
      { name: "Unpaid", value: summary?.unpaidStudents ?? 0 },
    ]
  }, [summary])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {loading && (
        <Card className="p-4 sm:p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading dashboard...
        </Card>
      )}

      {error && (
        <Card className="p-4 sm:p-6 text-sm text-destructive">
          {error}
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index} className="p-4 sm:p-6 hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">{metric.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{metric.value}</p>
                </div>
                <div className={`${metric.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Trend */}
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-lg text-foreground mb-4">Student Enrollment Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={enrollmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="students"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ fill: "var(--chart-1)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Weekly Attendance */}
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-lg text-foreground mb-4">Weekly Attendance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="present" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="absent" fill="var(--destructive)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold text-lg text-foreground mb-4">Payment Status</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Paid Students: {(summary?.paidStudents ?? 0).toLocaleString()}</p>
            <p className="text-muted-foreground">Unpaid Students: {(summary?.unpaidStudents ?? 0).toLocaleString()}</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={paymentData} dataKey="value" nameKey="name" outerRadius={90} label>
                <Cell fill="var(--chart-1)" />
                <Cell fill="var(--destructive)" />
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold text-lg text-foreground mb-4">Recent Activities</h3>
        <div className="space-y-3">
          {[
            { activity: "New student enrollment: John Doe", time: "2 hours ago" },
            { activity: "Attendance marked for Class 10-A", time: "4 hours ago" },
            { activity: "Payment received from 5 students", time: "6 hours ago" },
            { activity: "Teacher assignment updated", time: "8 hours ago" },
          ].map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <p className="text-foreground text-sm">{item.activity}</p>
              <p className="text-muted-foreground text-xs whitespace-nowrap">{item.time}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
