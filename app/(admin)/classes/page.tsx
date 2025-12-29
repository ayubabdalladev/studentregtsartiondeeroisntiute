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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Manage Classes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create, update, and manage course assignments.</p>
        </div>
        <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6">
          <Plus className="w-5 h-5" /> Add Class
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground border border-dashed rounded-xl bg-card/50">
          <Spinner className="w-8 h-8 text-primary" />
          <span>Loading classes...</span>
        </div>
      ) : error ? (
        <div className="space-y-4 p-6 border border-destructive/20 bg-destructive/5 rounded-xl">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchClasses} className="border-destructive/30 hover:bg-destructive/10">
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-12 text-center flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-muted">
            <Plus className="w-8 h-8 opacity-50" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium text-foreground">No classes yet</p>
            <p className="text-muted-foreground text-sm">Create your first class to get started.</p>
          </div>
          <Button className="mt-2 rounded-full" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Class
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[200px]">Class Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell whitespace-nowrap">Level</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Teacher</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell text-right whitespace-nowrap">Students</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((cls) => (
                  <TableRow key={cls.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 font-medium">
                      <div className="space-y-0.5">
                        <div className="text-base text-foreground font-semibold">{cls.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden flex flex-wrap gap-2">
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-medium tracking-wide">Level: {cls.level ?? "—"}</span>
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-medium tracking-wide">Students: {cls.studentsCount ?? 0}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 text-muted-foreground">{cls.level ?? "—"}</TableCell>
                    <TableCell className="py-4 text-sm font-medium">{cls.teacher?.name ?? <span className="text-muted-foreground italic font-normal">Unassigned</span>}</TableCell>
                    <TableCell className="hidden md:table-cell text-right py-4 tabular-nums">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/50 border border-muted">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                        {cls.studentsCount ?? 0}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {cls.isActive ? (
                        <Badge className="rounded-full shadow-none px-3 font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-full shadow-none px-3 font-semibold bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(cls)}
                          aria-label="Edit class"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(cls.id)}
                          aria-label="Delete class"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
