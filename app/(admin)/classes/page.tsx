"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"

type Teacher = {
  id: string
  name: string
  email: string
}

type ClassRow = {
  id: string
  name: string
  level: string | null
  isActive: boolean
  teacherId?: string | null
  teacher?: Teacher | null
  studentsCount?: number
}

const NO_TEACHER_VALUE = "__none__"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [level, setLevel] = useState("")
  const [teacherId, setTeacherId] = useState<string>(NO_TEACHER_VALUE)
  const [isActive, setIsActive] = useState(true)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const resetForm = () => {
    setName("")
    setLevel("")
    setTeacherId(NO_TEACHER_VALUE)
    setIsActive(true)
    setEditing(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (cls: ClassRow) => {
    setEditing(cls)
    setName(cls.name ?? "")
    setLevel(cls.level ?? "")
    setTeacherId(cls.teacherId ?? NO_TEACHER_VALUE)
    setIsActive(Boolean(cls.isActive))
    setFormOpen(true)
  }

  const fetchClasses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<ClassRow[]>("/api/classes")
      setClasses(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const res = await api.get<Teacher[]>("/api/teachers")
      setTeachers(res.data)
    } catch (e: any) {
      toast({
        title: "Failed to load teachers",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    void fetchTeachers()
    void fetchClasses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Class name is required", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        level: level.trim() ? level.trim() : null,
        teacherId: teacherId === NO_TEACHER_VALUE ? null : teacherId,
        isActive,
      }

      if (editing) {
        await api.patch(`/api/classes/${editing.id}`, payload)
        toast({ title: "Class updated" })
      } else {
        await api.post("/api/classes", payload)
        toast({ title: "Class created" })
      }

      setFormOpen(false)
      resetForm()
      await fetchClasses()
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    const previous = classes
    setClasses((current) => current.filter((c) => c.id !== deleteId))

    try {
      await api.delete(`/api/classes/${deleteId}`)
      toast({ title: "Class deleted" })
    } catch (e: any) {
      setClasses(previous)
      toast({
        title: "Delete failed",
        description: getErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const rows = useMemo(() => classes, [classes])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Classes</h1>
          <p className="text-muted-foreground">Create, update, and manage class assignments.</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Class
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>Loading classes…</span>
        </div>
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" onClick={fetchClasses}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-foreground font-medium">No classes yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create your first class to get started.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Class
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="text-muted-foreground">{cls.level ?? "—"}</TableCell>
                  <TableCell>{cls.teacher?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-right tabular-nums">{cls.studentsCount ?? 0}</TableCell>
                  <TableCell>
                    {cls.isActive ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600/90">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cls)} aria-label="Edit class">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(cls.id)}
                        aria-label="Delete class"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
            <DialogTitle>{editing ? "Edit Class" : "Add Class"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update class details and assignment." : "Create a new class and optionally assign a teacher."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name</Label>
              <Input
                id="className"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Class A"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="classLevel">Level</Label>
              <Input
                id="classLevel"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. Level 1 (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Assign Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
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
              {teacherId !== NO_TEACHER_VALUE && (
                <p className="text-xs text-muted-foreground">
                  {teachers.find((t) => t.id === teacherId)?.email}
                </p>
              )}
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">Activate or deactivate this class.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{isActive ? "Active" : "Inactive"}</span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving…
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Class"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>This action can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Deleting…
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

