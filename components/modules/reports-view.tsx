"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Download } from "lucide-react"
import { api } from "@/lib/api"

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

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function ReportsView() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<ReportsSummary>("/api/reports/summary")
        setSummary(res.data)
      } catch (e: any) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const enrollmentData = useMemo(() => (summary?.enrollmentTrends ?? []).map((p) => ({ month: p.label, students: p.value })), [summary])
  const attendanceData = useMemo(() => (summary?.weeklyAttendance ?? []).map((p) => ({ day: p.label, present: p.present, absent: p.absent })), [summary])
  const paymentData = useMemo(
    () => [
      { name: "Paid", value: summary?.paidStudents ?? 0 },
      { name: "Unpaid", value: summary?.unpaidStudents ?? 0 },
    ],
    [summary],
  )

  const downloadReport = async () => {
    setDownloading(true)
    try {
      const res = await api.get<Blob>("/api/reports/download", { responseType: "blob" as any })
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `school-report-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Comprehensive overview of school performance and metrics.</p>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6"
          onClick={downloadReport}
          disabled={loading || downloading || Boolean(error)}
        >
          <Download className="w-4 h-4" /> {downloading ? "Preparing..." : "Download Report"}
        </Button>
      </div>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading reports...
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { title: "Total Students", value: summary?.totalStudents ?? 0, desc: "Active enrollments" },
          { title: "Total Teachers", value: summary?.totalTeachers ?? 0, desc: "Staff members" },
          { title: "Active Classes", value: summary?.totalClasses ?? 0, desc: "Across all levels" },
          { title: "Attendance Rate", value: `${(summary?.attendanceRate ?? 0).toFixed(1)}%`, desc: "Average daily" },
        ].map((item, i) => (
          <Card key={item.title} className="p-6 transition-all hover:shadow-md flex flex-col justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{item.title}</p>
              <p className="text-3xl font-bold text-foreground mt-2 tracking-tight tabular-nums">{item.value}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-dashed">{item.desc}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="font-bold text-lg text-foreground tracking-tight">Student Enrollment</h3>
            <p className="text-sm text-muted-foreground">New student registrations over the last 6 months.</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrollmentData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
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
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  itemStyle={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Bar dataKey="students" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-6">
            <h3 className="font-bold text-lg text-foreground tracking-tight">Weekly Attendance</h3>
            <p className="text-sm text-muted-foreground">Daily breakdown of present vs absent students.</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="day"
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
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  itemStyle={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar name="Present" dataKey="present" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar name="Absent" dataKey="absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-8 items-start justify-between">
          <div className="space-y-6 md:w-1/3">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-foreground tracking-tight">Revenue & Payments</h3>
              <p className="text-sm text-muted-foreground">Financial overview and payment status distribution.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Total Monthly Revenue</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">{(summary?.monthlyRevenue ?? 0).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Paid Students</p>
                  <p className="text-xl font-bold tabular-nums text-emerald-700">{(summary?.paidStudents ?? 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-rose-500/10 rounded-lg border border-rose-500/20">
                  <p className="text-xs text-rose-600 font-medium uppercase tracking-wide mb-1">Unpaid Students</p>
                  <p className="text-xl font-bold tabular-nums text-rose-700">{(summary?.unpaidStudents ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3 h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                >
                  <Cell fill="var(--chart-1)" strokeWidth={0} />
                  <Cell fill="hsl(var(--destructive))" strokeWidth={0} />
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  itemStyle={{ color: "var(--foreground)", fontSize: 13, fontWeight: 500 }}
                />
                <Legend
                  verticalAlign="middle"
                  layout="vertical"
                  align="right"
                  wrapperStyle={{ paddingLeft: "40px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  )
}
