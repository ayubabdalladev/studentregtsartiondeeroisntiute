"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Users } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"

type TeacherClass = {
  id: string
  name: string
  level: string | null
  studentsCount: number
}

type StudentRow = {
  id: string
  firstName: string
  lastName: string
}

type AttendanceStatus = "PRESENT" | "ABSENT"

function formatDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function TeacherAttendance() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [date, setDate] = useState<string>(() => formatDateInputValue(new Date()))

  const [students, setStudents] = useState<StudentRow[]>([])
  const [statusByStudentId, setStatusByStudentId] = useState<Record<string, AttendanceStatus>>({})

  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoadingClasses(true)
      try {
        const res = await api.get<TeacherClass[]>("/api/attendance/classes")
        setClasses(res.data)
        if (res.data.length) setSelectedClassId((current) => current || res.data[0].id)
      } catch (e: any) {
        toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoadingClasses(false)
      }
    }
    void run()
  }, [])

  const selectedClass = useMemo(() => classes.find((c) => c.id === selectedClassId) ?? null, [classes, selectedClassId])

  useEffect(() => {
    const run = async () => {
      if (!selectedClassId) {
        setStudents([])
        setStatusByStudentId({})
        return
      }
      setLoadingStudents(true)
      try {
        const res = await api.get<{ students: StudentRow[]; attendance: Record<string, AttendanceStatus> }>(
          `/api/attendance/classes/${selectedClassId}/students?date=${encodeURIComponent(date)}`,
        )
        setStudents(res.data.students)
        setStatusByStudentId(res.data.attendance ?? {})
      } catch (e: any) {
        toast({ title: "Failed to load students", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoadingStudents(false)
      }
    }
    void run()
  }, [selectedClassId, date])

  const markAll = (status: AttendanceStatus) => {
    setStatusByStudentId((current) => {
      const next = { ...current }
      for (const s of students) next[s.id] = status
      return next
    })
  }

  const submit = async () => {
    if (!selectedClassId) return
    if (!students.length) {
      toast({ title: "No students in this class", variant: "destructive" })
      return
    }

    const items = students.map((s) => ({
      studentId: s.id,
      status: statusByStudentId[s.id] ?? "ABSENT",
    }))

    setSubmitting(true)
    try {
      await api.post("/api/attendance", { date, classId: selectedClassId, items })
      toast({ title: "Attendance saved" })
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark present/absent for your assigned classes.</p>
        </div>
        <div className="hidden sm:block">
          <Button className="w-full sm:w-auto px-8" onClick={submit} disabled={submitting || loadingStudents || !selectedClassId}>
            {submitting ? (
              <>
                <Spinner className="mr-2" />
                Saving...
              </>
            ) : (
              "Submit Attendance"
            )}
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Class</p>
            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={loadingClasses}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={loadingClasses ? "Loading..." : "Select a class"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClass && (
              <p className="text-xs text-muted-foreground">
                {selectedClass.level ? `${selectedClass.level} • ` : ""}
                {selectedClass.studentsCount} students
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Date</p>
            <input
              type="date"
              className="w-full h-11 px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Action</p>
            <div className="flex gap-2">
              <Button className="flex-1 h-11 border-2" variant="outline" onClick={() => markAll("PRESENT")} disabled={!students.length}>
                All Present
              </Button>
              <Button className="flex-1 h-11 border-2" variant="outline" onClick={() => markAll("ABSENT")} disabled={!students.length}>
                All Absent
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden mb-20 sm:mb-0">
        {loadingStudents ? (
          <div className="p-12 flex flex-col items-center gap-4 text-muted-foreground">
            <Spinner className="w-8 h-8" />
            <p className="animate-pulse">Loading class list...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border-dashed">
            <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 opacity-40" />
            </div>
            <p>No students found for this class.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden p-3 space-y-3 bg-muted/20">
              {students.map((s) => {
                const status = statusByStudentId[s.id] ?? "ABSENT"
                const initials = `${s.firstName[0]}${s.lastName[0]}`.toUpperCase()
                
                return (
                  <div key={s.id} className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground text-base truncate">
                          {s.firstName} {s.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">ID: {s.id.slice(-6).toUpperCase()}</div>
                      </div>
                      <Badge 
                        variant={status === "PRESENT" ? "default" : "destructive"} 
                        className="rounded-full px-3 py-0.5 text-[10px] h-fit font-bold"
                      >
                        {status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={status === "PRESENT" ? "default" : "outline"}
                        className={`h-12 rounded-xl border-2 transition-all active:scale-95 ${
                          status === "PRESENT" 
                            ? "border-primary shadow-md" 
                            : "border-muted-foreground/10"
                        }`}
                        onClick={() => setStatusByStudentId((cur) => ({ ...cur, [s.id]: "PRESENT" }))}
                      >
                        <span className="font-bold">Present</span>
                      </Button>
                      <Button
                        variant={status === "ABSENT" ? "destructive" : "outline"}
                        className={`h-12 rounded-xl border-2 transition-all active:scale-95 ${
                          status === "ABSENT" 
                            ? "border-destructive shadow-md" 
                            : "border-muted-foreground/10"
                        }`}
                        onClick={() => setStatusByStudentId((cur) => ({ ...cur, [s.id]: "ABSENT" }))}
                      >
                        <span className="font-bold">Absent</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[100px] py-4 pl-6">Student ID</TableHead>
                    <TableHead className="py-4">Full Name</TableHead>
                    <TableHead className="py-4">Status</TableHead>
                    <TableHead className="py-4 text-right pr-6">Quick Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const status = statusByStudentId[s.id] ?? "ABSENT"
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/40 transition-colors border-b">
                        <TableCell className="pl-6 py-4 font-mono text-xs text-muted-foreground uppercase">{s.id.slice(-6)}</TableCell>
                        <TableCell className="py-4 font-bold text-foreground font-medium">
                          {s.firstName} {s.lastName}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant={status === "PRESENT" ? "default" : "secondary"}
                            className={status === "ABSENT" ? "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200" : ""}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant={status === "PRESENT" ? "default" : "secondary"}
                              size="sm"
                              className="w-24 shadow-sm"
                              onClick={() => setStatusByStudentId((cur) => ({ ...cur, [s.id]: "PRESENT" }))}
                            >
                              Present
                            </Button>
                            <Button
                              variant={status === "ABSENT" ? "destructive" : "secondary"}
                              size="sm"
                              className="w-24 shadow-sm"
                              onClick={() => setStatusByStudentId((cur) => ({ ...cur, [s.id]: "ABSENT" }))}
                            >
                              Absent
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* Floating Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border sm:hidden z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <Button 
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20" 
          onClick={submit} 
          disabled={submitting || loadingStudents || !selectedClassId}
        >
          {submitting ? (
            <>
              <Spinner className="mr-2" />
              Saving Attendance...
            </>
          ) : (
            "Complete & Submit"
          )}
        </Button>
      </div>
    </div>
  )
}

