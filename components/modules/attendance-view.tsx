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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Attendance Management</h1>
          <p className="text-sm text-muted-foreground">View teacher-submitted attendance (admin).</p>
        </div>
        <Button
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
          onClick={downloadCsv}
          disabled={!selectedClassId || selectedClassId === ALL_CLASS_VALUE || downloading || loading || loadingRecords}
        >
          <Download className="w-4 h-4" /> {downloading ? "Preparing..." : "Export CSV"}
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Class</div>
          <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={loading}>
            <SelectTrigger>
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
        <input
          type="date"
          className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading...
        </Card>
      ) : summaryRows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No attendance found for the selected date/class.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryRows.map((row) => (
            <Card key={row.class.id} className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground truncate">{row.class.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {summary?.date} {row.class.level ? `• ${row.class.level}` : ""}
                  </p>
                  {row.teachers.length ? (
                    <p className="text-xs text-muted-foreground mt-1 truncate">Teacher: {row.teachers[0].name}{row.teachers.length > 1 ? ` +${row.teachers.length - 1}` : ""}</p>
                  ) : null}
                </div>
                <span className="text-2xl font-bold text-chart-1 tabular-nums">{row.percentage}%</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">Present</span>
                  <span className="text-chart-1 font-medium tabular-nums">{row.presentCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">Absent</span>
                  <span className="text-destructive font-medium tabular-nums">{row.absentCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">Total</span>
                  <span className="text-muted-foreground font-medium tabular-nums">{row.total}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 sm:p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-base font-semibold">Class Records</div>
              <div className="text-sm text-muted-foreground">
                {selectedClass ? selectedClass.name : selectedClassId === ALL_CLASS_VALUE ? "All classes" : "Select a class"} • {date}
              </div>
            </div>
            {loadingRecords ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Loading...
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{records?.total ?? 0} records</div>
            )}
          </div>
        </div>

        {loadingRecords ? (
          <div className="p-6 text-sm text-muted-foreground">Loading records...</div>
        ) : !records || records.data.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No records.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Teacher</TableHead>
                  <TableHead className="hidden md:table-cell">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-0.5">
                        <div className="truncate">{r.student ? `${r.student.firstName} ${r.student.lastName}` : "—"}</div>
                        <div className="text-xs text-muted-foreground md:hidden truncate">
                          {r.teacher?.name ?? "—"} • {r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "PRESENT" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{r.teacher?.name ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
