"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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
        <Button onClick={submit} disabled={submitting || loadingStudents || !selectedClassId}>
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

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Class</p>
            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={loadingClasses}>
              <SelectTrigger>
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
              className="w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Quick Actions</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => markAll("PRESENT")} disabled={!students.length}>
                Mark All Present
              </Button>
              <Button variant="secondary" onClick={() => markAll("ABSENT")} disabled={!students.length}>
                Mark All Absent
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loadingStudents ? (
          <div className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Spinner />
            Loading students...
          </div>
        ) : students.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No students found for this class.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const status = statusByStudentId[s.id] ?? "ABSENT"
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      <TableCell>
                        <Badge variant={status === "PRESENT" ? "default" : "secondary"}>{status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant={status === "PRESENT" ? "default" : "secondary"}
                            size="sm"
                            onClick={() => setStatusByStudentId((cur) => ({ ...cur, [s.id]: "PRESENT" }))}
                          >
                            Present
                          </Button>
                          <Button
                            variant={status === "ABSENT" ? "destructive" : "secondary"}
                            size="sm"
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
        )}
      </Card>
    </div>
  )
}

