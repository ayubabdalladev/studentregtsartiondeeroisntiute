"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Download,
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Wallet,
  TrendingUp,
} from "lucide-react"
import { api } from "@/lib/api"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

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

const enrollmentChartConfig = {
  students: { label: "New Students", color: "var(--chart-1)" },
} satisfies ChartConfig

const attendanceChartConfig = {
  present: { label: "Present", color: "var(--chart-1)" },
  absent: { label: "Absent", color: "var(--chart-2)" },
} satisfies ChartConfig

const paymentChartConfig = {
  paid: { label: "Paid", color: "var(--chart-1)" },
  unpaid: { label: "Unpaid", color: "var(--chart-2)" },
} satisfies ChartConfig

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="border-muted/50 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-foreground tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0 p-2.5 rounded-xl bg-primary/8 text-primary">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="px-4 pb-6 pt-2">{children}</div>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-muted bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export default function ReportsView() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

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

  const enrollmentData = useMemo(
    () => (summary?.enrollmentTrends ?? []).map((p) => ({ month: p.label, students: p.value })),
    [summary],
  )
  const attendanceData = useMemo(
    () => (summary?.weeklyAttendance ?? []).map((p) => ({ day: p.label, present: p.present, absent: p.absent })),
    [summary],
  )
  const paymentData = useMemo(() => {
    const paid = summary?.paidStudents ?? 0
    const unpaid = summary?.unpaidStudents ?? 0
    return [
      { status: "paid", count: paid, fill: "var(--color-paid)" },
      { status: "unpaid", count: unpaid, fill: "var(--color-unpaid)" },
    ]
  }, [summary])

  const paymentTotal = (summary?.paidStudents ?? 0) + (summary?.unpaidStudents ?? 0)
  const paidPercent = paymentTotal > 0 ? Math.round(((summary?.paidStudents ?? 0) / paymentTotal) * 100) : 0

  const metrics = useMemo(
    () => [
      {
        label: "Total Students",
        value: (summary?.totalStudents ?? 0).toLocaleString(),
        hint: "Active enrollments",
        icon: Users,
        accent: "from-[#1E4497]/15 to-[#1E4497]/5",
        iconBg: "bg-[#1E4497]",
      },
      {
        label: "Total Teachers",
        value: (summary?.totalTeachers ?? 0).toLocaleString(),
        hint: "Staff members",
        icon: GraduationCap,
        accent: "from-[#EB4824]/15 to-[#EB4824]/5",
        iconBg: "bg-[#EB4824]",
      },
      {
        label: "Active Classes",
        value: (summary?.totalClasses ?? 0).toLocaleString(),
        hint: "Across all levels",
        icon: BookOpen,
        accent: "from-violet-500/15 to-violet-500/5",
        iconBg: "bg-violet-600",
      },
      {
        label: "Attendance Rate",
        value: `${(summary?.attendanceRate ?? 0).toFixed(1)}%`,
        hint: "Last 7 days average",
        icon: Calendar,
        accent: "from-emerald-500/15 to-emerald-500/5",
        iconBg: "bg-emerald-600",
      },
    ],
    [summary],
  )

  const downloadExcel = async () => {
    setDownloadingExcel(true)
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
      setDownloadingExcel(false)
    }
  }

  const downloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const res = await api.get<Blob>("/api/reports/download/pdf", { responseType: "blob" as any })
      const blob = new Blob([res.data], { type: "application/pdf" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `school-report-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#1E4497]/10 via-background to-[#EB4824]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#1E4497]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#EB4824]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full bg-background/80 border-primary/20 text-primary font-medium">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Analytics
              </Badge>
              {!loading && summary && (
                <Badge variant="outline" className="rounded-full border-emerald-200 text-emerald-700 bg-emerald-50">
                  {paidPercent}% students paid
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Full overview of enrollment, attendance, and payments. Download reports anytime.
            </p>
          </div>
          <div className="flex w-full lg:w-auto gap-2 shrink-0">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 lg:flex-none rounded-full gap-2 px-5 bg-background/80"
              onClick={downloadPdf}
              disabled={loading || downloadingPdf || Boolean(error)}
            >
              <Download className="w-4 h-4" />
              {downloadingPdf ? "Preparing..." : "PDF"}
            </Button>
            <Button
              size="lg"
              className="flex-1 lg:flex-none rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-5"
              onClick={downloadExcel}
              disabled={loading || downloadingExcel || Boolean(error)}
            >
              <Download className="w-4 h-4" />
              {downloadingExcel ? "Preparing..." : "Excel"}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 border-dashed flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/5">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading reports...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive border-destructive/20 bg-destructive/5">{error}</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <Card
                  key={metric.label}
                  className="relative overflow-hidden border-muted/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent} pointer-events-none`} />
                  <div className="relative p-5 sm:p-6 flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{metric.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums">{metric.value}</p>
                      <p className="text-xs text-muted-foreground font-medium">{metric.hint}</p>
                    </div>
                    <div className={`shrink-0 p-2.5 rounded-xl text-white shadow-sm ${metric.iconBg}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Student Enrollment" description="New registrations over the last 6 months" icon={TrendingUp}>
              {enrollmentData.length === 0 ? (
                <EmptyChart message="No enrollment data yet" />
              ) : (
                <ChartContainer config={enrollmentChartConfig} className="h-[280px] w-full">
                  <BarChart data={enrollmentData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="students" fill="var(--color-students)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartCard>

            <ChartCard title="Weekly Attendance" description="Present vs absent students this week" icon={Calendar}>
              {attendanceData.length === 0 ? (
                <EmptyChart message="No attendance data yet" />
              ) : (
                <ChartContainer config={attendanceChartConfig} className="h-[280px] w-full">
                  <BarChart data={attendanceData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="present" fill="var(--color-present)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="absent" fill="var(--color-absent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ChartContainer>
              )}
            </ChartCard>
          </div>

          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-base text-foreground tracking-tight">Revenue & Payments</h3>
                <p className="text-sm text-muted-foreground">Financial overview and payment status</p>
              </div>
              <div className="shrink-0 p-2.5 rounded-xl bg-primary/8 text-primary">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 space-y-4">
                <div className="p-5 rounded-xl border border-[#1E4497]/20 bg-gradient-to-br from-[#1E4497]/10 to-transparent">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Revenue</p>
                  <p className="text-3xl font-bold tabular-nums text-[#1E4497] mt-1">
                    {formatCurrency(summary?.monthlyRevenue ?? 0)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Paid</p>
                    <p className="text-2xl font-bold tabular-nums text-emerald-800 mt-1">
                      {(summary?.paidStudents ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50">
                    <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Unpaid</p>
                    <p className="text-2xl font-bold tabular-nums text-rose-800 mt-1">
                      {(summary?.unpaidStudents ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                {paymentTotal === 0 ? (
                  <EmptyChart message="No payment data yet" />
                ) : (
                  <ChartContainer config={paymentChartConfig} className="mx-auto h-[260px] w-full max-w-[420px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="status" />} />
                      <Pie
                        data={paymentData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={4}
                        strokeWidth={0}
                      >
                        {paymentData.map((entry) => (
                          <Cell key={entry.status} fill={entry.fill} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 8} className="fill-foreground text-2xl font-bold">
                                    {paidPercent}%
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 16} className="fill-muted-foreground text-xs">
                                    Paid
                                  </tspan>
                                </text>
                              )
                            }
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
