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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Real-time summaries from the database.</p>
        </div>
        <Button
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: "Students", value: summary?.totalStudents ?? 0 },
          { title: "Teachers", value: summary?.totalTeachers ?? 0 },
          { title: "Classes", value: summary?.totalClasses ?? 0 },
          { title: "Attendance Rate", value: `${(summary?.attendanceRate ?? 0).toFixed(1)}%` },
        ].map((item) => (
          <Card key={item.title} className="p-4 sm:p-6">
            <p className="text-muted-foreground text-sm font-medium">{item.title}</p>
            <p className="text-3xl font-bold text-foreground mt-2">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-lg text-foreground mb-4">Student Enrollment (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={enrollmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
              <Bar dataKey="students" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 sm:p-6">
          <h3 className="font-semibold text-lg text-foreground mb-4">Weekly Attendance</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
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
            <p className="text-muted-foreground">Monthly Revenue: {(summary?.monthlyRevenue ?? 0).toLocaleString()}</p>
            <p className="text-muted-foreground">Paid Students: {(summary?.paidStudents ?? 0).toLocaleString()}</p>
            <p className="text-muted-foreground">Unpaid Students: {(summary?.unpaidStudents ?? 0).toLocaleString()}</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={paymentData} dataKey="value" nameKey="name" outerRadius={90} label>
                <Cell fill="var(--chart-1)" />
                <Cell fill="var(--destructive)" />
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
