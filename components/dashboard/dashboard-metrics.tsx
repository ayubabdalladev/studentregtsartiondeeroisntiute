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
import { Badge } from "@/components/ui/badge"
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
  lastMonthRevenue: number
  largestClasses: Array<{ name: string; students: number }>
  highestAbsenceClasses: Array<{ name: string; rate: number }>
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
        const summaryRes = await api.get<ReportsSummary>("/api/reports/summary")
        setSummary(summaryRes.data)
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
        subValue: summary ? `${summary.monthlyRevenue >= summary.lastMonthRevenue ? "+" : ""}${formatCurrency(summary.monthlyRevenue - summary.lastMonthRevenue)} vs last month` : "",
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
                  {"subValue" in metric && metric.subValue && (
                    <p className={`text-xs font-medium ${summary && summary.monthlyRevenue >= summary.lastMonthRevenue ? "text-emerald-600" : "text-amber-600"}`}>
                      {metric.subValue}
                    </p>
                  )}
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
            <h3 className="font-bold text-lg text-foreground tracking-tight">Top Classes</h3>
            <p className="text-sm text-muted-foreground">Classes with most students & high absence.</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Largest Classes</h4>
              {summary?.largestClasses?.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-muted">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{c.students} Students</Badge>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Highest Absence Rate</h4>
              {summary?.highestAbsenceClasses?.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Badge variant="outline" className="text-destructive border-destructive/20 font-mono">{c.rate}% Absent</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Enrollment Trend Chart - Moved to its own card or below */}
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

        {/* Payment Status */}
        <Card className="p-6 flex flex-col">
          <h3 className="font-bold text-lg text-foreground mb-6 tracking-tight">Payment Status Overview</h3>
          <div className="flex flex-col items-center justify-between gap-6 h-full">
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
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
            </div>
            
            <div className="w-full grid grid-cols-2 gap-3 mt-auto">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Paid</p>
                <p className="text-2xl font-black text-emerald-700">{(summary?.paidStudents ?? 0)}</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tighter">Unpaid</p>
                <p className="text-2xl font-black text-rose-700">{(summary?.unpaidStudents ?? 0)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
