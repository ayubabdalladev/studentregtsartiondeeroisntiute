"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }

type AttendanceSummaryRow = {
  class: { id: string; name: string; level: string | null }
  presentCount: number
  absentCount: number
  total: number
  percentage: number
  teachers: Array<{ id: string; name: string; email: string }>
}

type AttendanceSummaryResponse = { date: string; data: AttendanceSummaryRow[] }

type AttendanceRecordRow = {
  id: string
  status: "PRESENT" | "ABSENT"
  note: string | null
  student: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null
  teacher: { id: string; name: string; email: string } | null
  createdAt: string | null
}

type AttendanceRecordsResponse = {
  date: string
  class: { id: string; name: string; level: string | null }
  total: number
  data: AttendanceRecordRow[]
}

const ALL_CLASS_VALUE = "__all__"

function formatDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function AttendanceView() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [date, setDate] = useState<string>(() => formatDateInputValue(new Date()))

  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null)
  const [records, setRecords] = useState<AttendanceRecordsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.get<ClassOption[]>("/api/classes")
        setClasses(res.data)
        if (res.data.length) setSelectedClassId((cur) => cur || res.data[0].id)
      } catch (e: any) {
        toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const loadSummary = async () => {
    try {
      const effectiveClassId = selectedClassId && selectedClassId !== ALL_CLASS_VALUE ? selectedClassId : null
      const url = effectiveClassId
        ? `/api/attendance/summary?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(selectedClassId)}`
        : `/api/attendance/summary?date=${encodeURIComponent(date)}`
      const res = await api.get<AttendanceSummaryResponse>(url)
      setSummary(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load attendance summary", description: getErrorMessage(e), variant: "destructive" })
      setSummary(null)
    }
  }

  const loadRecords = async () => {
    if (!selectedClassId || selectedClassId === ALL_CLASS_VALUE) {
      setRecords(null)
      return
    }
    setLoadingRecords(true)
    try {
      const res = await api.get<AttendanceRecordsResponse>(
        `/api/attendance/records?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(selectedClassId)}&limit=1000`,
      )
      setRecords(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load records", description: getErrorMessage(e), variant: "destructive" })
      setRecords(null)
    } finally {
      setLoadingRecords(false)
    }
  }

  useEffect(() => {
    if (!date) return
    void loadSummary()
    void loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedClassId])

  const summaryRows = useMemo(() => summary?.data ?? [], [summary])
  const selectedClass = useMemo(
    () => (selectedClassId && selectedClassId !== ALL_CLASS_VALUE ? classes.find((c) => c.id === selectedClassId) ?? null : null),
    [classes, selectedClassId],
  )

  const downloadCsv = async () => {
    if (!selectedClassId || selectedClassId === ALL_CLASS_VALUE) return
    setDownloading(true)
    try {
      const data =
        records && records.date === date && records.class.id === selectedClassId
          ? records
          : (await api.get<AttendanceRecordsResponse>(
            `/api/attendance/records?date=${encodeURIComponent(date)}&classId=${encodeURIComponent(selectedClassId)}&limit=1000`,
          )).data
      const lines = [
        ["Date", "Class", "Student", "Status", "Teacher", "CreatedAt"].join(","),
        ...data.data.map((r) => {
          const studentName = r.student ? `${r.student.firstName} ${r.student.lastName}`.trim() : ""
          const teacherName = r.teacher ? r.teacher.name : ""
          const createdAt = r.createdAt ? new Date(r.createdAt).toISOString() : ""
          return [
            data.date,
            `"${data.class.name.replace(/"/g, '""')}"`,
            `"${studentName.replace(/"/g, '""')}"`,
            r.status,
            `"${teacherName.replace(/"/g, '""')}"`,
            createdAt,
          ].join(",")
        }),
      ].join("\n")

      const blob = new Blob([lines], { type: "text/csv;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `attendance-${data.class.name}-${data.date}.csv`.replace(/\s+/g, "-").toLowerCase()
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Download failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Attendance Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View and manage teacher-submitted attendance records.</p>
        </div>
        <Button
          className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6"
          onClick={downloadCsv}
          disabled={!selectedClassId || selectedClassId === ALL_CLASS_VALUE || downloading || loading || loadingRecords}
        >
          <Download className="w-4 h-4" /> {downloading ? "Preparing..." : "Export CSV"}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-xl border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          <div className="space-y-2 lg:col-span-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class</div>
            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={loading}>
              <SelectTrigger className="h-11 rounded-lg border-muted shadow-sm">
                <SelectValue placeholder={loading ? "Loading..." : "Select a class"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLASS_VALUE}>All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!classes.length && !loading ? <div className="text-xs text-muted-foreground">Create a class first.</div> : null}
          </div>
          <div className="space-y-2 lg:col-span-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</div>
            <input
              type="date"
              className="w-full h-11 px-4 py-2 border border-muted rounded-lg bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading summary...</p>
        </Card>
      ) : summaryRows.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Download className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No attendance found</p>
          <p className="text-sm">Try selecting a different date or class.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaryRows.map((row) => (
            <Card key={row.class.id} className="p-6 transition-all hover:shadow-md border-muted/60">
              <div className="flex items-start justify-between mb-6 gap-4">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-lg font-bold text-foreground truncate tracking-tight">{row.class.name}</h3>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {summary?.date} {row.class.level ? `• ${row.class.level}` : ""}
                    </p>
                    {row.teachers.length ? (
                      <p className="text-xs text-muted-foreground/80 truncate">By {row.teachers[0].name}{row.teachers.length > 1 ? ` +${row.teachers.length - 1}` : ""}</p>
                    ) : null}
                  </div>
                </div>
                <div className={`text-2xl font-bold tabular-nums ${row.percentage >= 90 ? 'text-emerald-600' : row.percentage >= 70 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {row.percentage}%
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-dashed">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground font-medium">Present</span>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 font-bold tabular-nums px-2.5">
                    {row.presentCount}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground font-medium">Absent</span>
                  <Badge variant="secondary" className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-100 font-bold tabular-nums px-2.5">
                    {row.absentCount}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm items-center pt-2">
                  <span className="font-semibold text-foreground">Total Students</span>
                  <span className="text-foreground font-bold tabular-nums">{row.total}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-lg font-bold tracking-tight">Class Records</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="font-medium text-foreground">{selectedClass ? selectedClass.name : selectedClassId === ALL_CLASS_VALUE ? "All classes" : "Select a class"}</span>
                <span>•</span>
                <span>{date}</span>
              </div>
            </div>
            {loadingRecords ? (
              <Badge variant="outline" className="w-fit gap-2 py-1.5"><Spinner className="w-3 h-3" /> Updating...</Badge>
            ) : (
              <Badge variant="secondary" className="w-fit font-mono">{records?.total ?? 0} records</Badge>
            )}
          </div>
        </div>

        {loadingRecords ? (
          <div className="p-12 flex justify-center text-muted-foreground"><Spinner /></div>
        ) : !records || records.data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm border-dashed">No records available for this selection.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Student</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Teacher</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right pr-6">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.data.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 font-medium">
                      <div className="space-y-0.5">
                        <div className="text-base text-foreground font-semibold line-clamp-1">{r.student ? `${r.student.firstName} ${r.student.lastName}` : "—"}</div>
                        <div className="text-xs text-muted-foreground md:hidden truncate flex items-center gap-1.5 pt-1">
                          <span>By {r.teacher?.name ?? "—"}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px]">{r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant="secondary"
                        className={`rounded-full shadow-none px-3 font-semibold ${r.status === "PRESENT"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200"
                          }`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 text-sm text-foreground/80">{r.teacher?.name ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground text-right pr-6 font-mono">
                      {r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
