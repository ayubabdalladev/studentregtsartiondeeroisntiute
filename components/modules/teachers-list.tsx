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
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }
type TeacherRow = {
  id: string
  name: string
  email: string
  isActive: boolean
  classes: Array<{ id: string; name: string; level: string | null }>
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function TeachersList() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TeacherRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setName("")
    setEmail("")
    setPassword("")
    setIsActive(true)
    setSelectedClassIds([])
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (teacher: TeacherRow) => {
    setEditing(teacher)
    setName(teacher.name ?? "")
    setEmail(teacher.email ?? "")
    setPassword("")
    setIsActive(Boolean(teacher.isActive))
    setSelectedClassIds(teacher.classes.map((c) => c.id))
    setFormOpen(true)
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
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<TeacherRow[]>("/api/teachers?includeInactive=true")
      setTeachers(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchClasses()
    void fetchTeachers()
  }, [])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
  }, [teachers, searchTerm])

  const toggleClass = (classId: string) => {
    setSelectedClassIds((current) => (current.includes(classId) ? current.filter((x) => x !== classId) : [...current, classId]))
  }

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" })
      return
    }

    if (!editing && password.trim().length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        classIds: selectedClassIds,
        isActive,
      }
      if (password.trim()) payload.password = password.trim()

      if (editing) {
        await api.patch(`/api/teachers/${editing.id}`, payload)
        toast({ title: "Teacher updated" })
      } else {
        await api.post("/api/teachers", payload)
        toast({ title: "Teacher created" })
      }

      setFormOpen(false)
      resetForm()
      await fetchTeachers()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.delete(`/api/teachers/${deleteId}`)
      toast({ title: "Teacher deleted" })
      await fetchTeachers()
    } catch (e: any) {
      toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Teacher Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create teachers and assign classes.</p>
        </div>
        <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6">
          <Plus className="w-5 h-5" /> Add Teacher
        </Button>
      </div>

      <div className="bg-card p-4 rounded-xl border shadow-sm">
        <div className="max-w-md space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search Teachers</Label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10 h-11 rounded-lg border-muted shadow-sm focus-visible:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading teachers...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Search className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No teachers found</p>
          <p className="text-sm">Try adjusting your search.</p>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[200px]">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell whitespace-nowrap">Email</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[200px]">Classes</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((teacher) => (
                  <TableRow key={teacher.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6 font-medium">
                      <div className="space-y-0.5">
                        <div className="text-base text-foreground font-semibold">{teacher.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden truncate">{teacher.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground">{teacher.email}</TableCell>
                    <TableCell className="py-4">
                      {teacher.classes.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {teacher.classes.slice(0, 3).map((c) => (
                            <Badge key={c.id} variant="secondary" className="font-normal bg-muted border-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground">
                              {c.name}
                            </Badge>
                          ))}
                          {teacher.classes.length > 3 && (
                            <Badge variant="secondary" className="font-normal bg-muted border-muted-foreground/20">+{teacher.classes.length - 3}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/60 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant="secondary"
                        className={`rounded-full shadow-none px-3 font-semibold ${teacher.isActive
                            ? "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200"
                          }`}
                      >
                        {teacher.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(teacher)}
                          aria-label="Edit teacher"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(teacher.id)}
                          aria-label="Delete teacher"
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
            <DialogTitle>{editing ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update teacher profile and class assignments." : "Create a teacher account (role=TEACHER)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacherName">Name</Label>
              <Input id="teacherName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherEmail">Email</Label>
              <Input id="teacherEmail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherPassword">{editing ? "New Password (optional)" : "Password"}</Label>
              <Input id="teacherPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editing ? "Leave blank to keep current" : ""} />
            </div>

            <div className="space-y-2">
              <Label>Assign Classes</Label>
              <Card className="p-3 max-h-56 overflow-auto">
                <div className="space-y-2">
                  {classes.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 text-sm cursor-pointer">
                      <Checkbox checked={selectedClassIds.includes(c.id)} onCheckedChange={() => toggleClass(c.id)} />
                      <span className="flex-1">{c.name}</span>
                      {!c.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </label>
                  ))}
                  {classes.length === 0 && <p className="text-sm text-muted-foreground">No classes available.</p>}
                </div>
              </Card>
              <p className="text-xs text-muted-foreground">{selectedClassIds.length} selected</p>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Deactivate to prevent login.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
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
                  Saving...
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Teacher"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the teacher and unassign their classes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Spinner className="mr-2" />
                  Working...
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
