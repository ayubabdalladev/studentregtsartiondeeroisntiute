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
import { Button } from "@/components/ui/button"
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

type ActivityRow = {
  id: string
  type: "enrollment" | "attendance" | "payment" | "teacher" | "class" | "course"
  message: string
  timestamp: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export default function DashboardMetrics() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [summaryRes, activitiesRes] = await Promise.all([
          api.get<ReportsSummary>("/api/reports/summary"),
          api.get<{ items: ActivityRow[] }>("/api/dashboard/activities?limit=8"),
        ])
        setSummary(summaryRes.data)
        setActivities(Array.isArray(activitiesRes.data?.items) ? activitiesRes.data.items : [])
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? "Failed to load dashboard data.")
      } finally {
        setLoading(false)
        setActivitiesLoading(false)
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Quick insights into your school's daily performance.</p>
      </div>

      {loading && (
        <Card className="p-12 border-dashed flex items-center justify-center gap-3 text-muted-foreground bg-muted/5">
          <Spinner className="w-6 h-6 text-primary" />
          <span>Syncing latest data...</span>
        </Card>
      )}

      {error && (
        <Card className="p-6 text-sm text-destructive border-destructive/20 bg-destructive/5 flex items-center gap-3">
          <span className="font-semibold">Error:</span> {error}
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index} className="p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 border-muted/60 relative overflow-hidden group">
              <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{metric.label}</p>
                  <p className="text-3xl font-extrabold text-foreground tracking-tight tabular-nums">{metric.value}</p>
                </div>
                <div className={`${metric.color} p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-muted/20 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Trend */}
        <Card className="p-6 flex flex-col">
          <div className="mb-6 space-y-1">
            <h3 className="font-bold text-lg text-foreground tracking-tight">Enrollment Growth</h3>
            <p className="text-sm text-muted-foreground">New students acquired per month.</p>
          </div>
          <div className="h-[300px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enrollmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="month"
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  fontSize={12}
                  fontWeight={500}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                  itemStyle={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Line
                  type="monotone"
                  dataKey="students"
                  stroke="var(--chart-1)"
                  strokeWidth={3}
                  dot={{ fill: "var(--chart-1)", r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Weekly Attendance */}
        <Card className="p-6 flex flex-col">
          <div className="mb-6 space-y-1">
            <h3 className="font-bold text-lg text-foreground tracking-tight">Attendance Overview</h3>
            <p className="text-sm text-muted-foreground">Weekly presence vs absence comparison.</p>
          </div>
          <div className="h-[300px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  fontSize={12}
                  fontWeight={500}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  fontSize={12}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                  itemStyle={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar name="Present" dataKey="present" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar name="Absent" dataKey="absent" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1">
          <h3 className="font-bold text-lg text-foreground mb-6 tracking-tight">Payment Status</h3>
          <div className="flex flex-col items-center justify-center h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  <Cell fill="var(--chart-1)" strokeWidth={0} />
                  <Cell fill="var(--destructive)" strokeWidth={0} />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                  itemStyle={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full grid grid-cols-2 gap-2 mt-4">
              <div className="text-center p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-muted-foreground uppercase">Paid</p>
                <p className="font-bold text-emerald-600">{(summary?.paidStudents ?? 0).toLocaleString()}</p>
              </div>
              <div className="text-center p-2 rounded bg-rose-500/10 border border-rose-500/20">
                <p className="text-xs text-muted-foreground uppercase">Unpaid</p>
                <p className="font-bold text-rose-600">{(summary?.unpaidStudents ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg text-foreground tracking-tight">Recent Activities</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Latest system events and updates.</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs">View All</Button>
          </div>

          <div className="space-y-0">
            {activities.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 p-4 sm:p-5 hover:bg-muted/30 transition-colors border-b last:border-0"
              >
                <div className={`mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.type === 'enrollment'
                    ? 'bg-blue-500'
                    : item.type === 'attendance'
                      ? 'bg-emerald-500'
                      : item.type === 'payment'
                        ? 'bg-amber-500'
                        : item.type === 'teacher'
                          ? 'bg-violet-500'
                          : item.type === 'class'
                            ? 'bg-cyan-500'
                            : item.type === 'course'
                              ? 'bg-fuchsia-500'
                              : 'bg-slate-500'
                  }`} />
                <div className="flex-1 space-y-1">
                  <p className="text-base font-semibold text-foreground leading-snug">{item.message}</p>
                  <p className="text-sm text-muted-foreground">{formatRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
            {activitiesLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading feed...</div>}
            {!activitiesLoading && activities.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No recent activity yet.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
