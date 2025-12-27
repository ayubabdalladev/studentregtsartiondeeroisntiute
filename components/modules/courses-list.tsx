"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Search } from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type CourseStatus = "ACTIVE" | "SCHEDULED" | "INACTIVE"

type TeacherOption = {
  id: string
  name: string
  email: string
  isActive?: boolean
}

type ClassOption = {
  id: string
  name: string
  level: string | null
  isActive: boolean
}

type CourseRow = {
  id: string
  name: string
  classId: string | null
  class: { id: string; name: string; level: string | null; isActive: boolean } | null
  teacherId: string | null
  teacher: { id: string; name: string; email: string } | null
  status: CourseStatus
  studentsCount: number
}

const NO_TEACHER_VALUE = "__none__"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function statusLabel(status: CourseStatus) {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "SCHEDULED":
      return "Scheduled"
    case "INACTIVE":
      return "Inactive"
  }
}

export default function CoursesList() {
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [classId, setClassId] = useState<string>("")
  const [teacherId, setTeacherId] = useState<string>(NO_TEACHER_VALUE)
  const [status, setStatus] = useState<CourseStatus>("ACTIVE")
  const [sendEmail, setSendEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setName("")
    setClassId("")
    setTeacherId(NO_TEACHER_VALUE)
    setStatus("ACTIVE")
    setSendEmail(false)
    setEmailSubject("")
    setEmailMessage("")
  }

  const openCreate = () => {
    resetForm()
    if (classes.length) setClassId(classes[0].id)
    setFormOpen(true)
  }

  const openEdit = (course: CourseRow) => {
    setEditing(course)
    setName(course.name ?? "")
    setClassId(course.classId ?? "")
    setTeacherId(course.teacherId ?? NO_TEACHER_VALUE)
    setStatus(course.status ?? "ACTIVE")
    setFormOpen(true)
  }

  const fetchCourses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<CourseRow[]>("/api/courses")
      setCourses(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await api.get<ClassOption[]>("/api/classes")
      setClasses(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load classes", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const fetchTeachers = async () => {
    try {
      const res = await api.get<TeacherOption[]>("/api/teachers?includeInactive=true")
      setTeachers(res.data)
    } catch (e: any) {
      toast({ title: "Failed to load teachers", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  useEffect(() => {
    void fetchClasses()
    void fetchTeachers()
    void fetchCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredCourses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) => {
      const teacherName = c.teacher?.name ?? ""
      const className = c.class?.name ?? ""
      return c.name.toLowerCase().includes(q) || teacherName.toLowerCase().includes(q) || className.toLowerCase().includes(q)
    })
  }, [courses, searchTerm])

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Course name is required", variant: "destructive" })
      return
    }
    if (!classId) {
      toast({ title: "Select a class", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        classId,
        teacherId: teacherId === NO_TEACHER_VALUE ? null : teacherId,
        status,
      }

      if (editing) {
        await api.patch(`/api/courses/${editing.id}`, payload)
        toast({ title: "Course updated" })
      } else {
        const created = await api.post<{ id: string; classId: string }>("/api/courses", payload)
        toast({ title: "Course created" })

        if (sendEmail && emailSubject.trim() && emailMessage.trim()) {
          await api.post("/api/notifications/email/broadcast", {
            courseId: created.data.id,
            subject: emailSubject.trim(),
            message: emailMessage.trim(),
          })
          toast({ title: "Email sent", description: "Announcement sent to students in this course/class." })
        }
      }

      setFormOpen(false)
      resetForm()
      await fetchCourses()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const prev = courses
    setCourses((cur) => cur.filter((c) => c.id !== deleteId))
    try {
      await api.delete(`/api/courses/${deleteId}`)
      toast({ title: "Course deleted" })
    } catch (e: any) {
      setCourses(prev)
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Courses & Classes</h1>
          <p className="text-sm text-muted-foreground">Create courses and assign teacher + class.</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Course
        </Button>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by course name, class, or teacher..."
            className="pl-10"
          />
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading courses...
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : filteredCourses.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No courses found.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.name}</TableCell>
                    <TableCell>{course.class?.name ?? "—"}</TableCell>
                    <TableCell>{course.teacher?.name ?? "Unassigned"}</TableCell>
                    <TableCell>{course.studentsCount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          course.status === "ACTIVE" ? "default" : course.status === "SCHEDULED" ? "secondary" : "outline"
                        }
                      >
                        {statusLabel(course.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(course)} aria-label="Edit course">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(course.id)} aria-label="Delete course">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Course" : "Add Course"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update course details and assignment." : "Create a new course and assign a class and teacher."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="courseName">Course Name</Label>
              <Input id="courseName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics 101" />
            </div>

            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!classes.length && <p className="text-xs text-muted-foreground">Create a class first.</p>}
            </div>

            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign a teacher (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER_VALUE}>Unassigned</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CourseStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editing && (
              <div className="space-y-3 rounded-lg border p-3">
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                  <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(Boolean(v))} />
                  <span className="font-medium">Send email announcement to students</span>
                </label>
                {sendEmail && (
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <Label htmlFor="emailSubject">Subject</Label>
                      <Input
                        id="emailSubject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Example: New class announcement"
                      />
                    </div>
                    <Label htmlFor="emailMessage">Message</Label>
                    <Textarea
                      id="emailMessage"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Example: New class is opening on Monday at 9:00 AM. Please attend on time."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">Uses student emails from their profiles.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !classes.length}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Course"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>This action can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
