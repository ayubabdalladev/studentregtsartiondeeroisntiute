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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Teacher Management</h1>
          <p className="text-sm text-muted-foreground">Create teachers and assign classes.</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Teacher
        </Button>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or email..." className="pl-10" />
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading teachers...
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No teachers found.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
                    <TableCell>
                      {teacher.classes.length ? (
                        <div className="flex flex-wrap gap-2">
                          {teacher.classes.slice(0, 3).map((c) => (
                            <Badge key={c.id} variant="secondary">
                              {c.name}
                            </Badge>
                          ))}
                          {teacher.classes.length > 3 && <Badge variant="secondary">+{teacher.classes.length - 3}</Badge>}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={teacher.isActive ? "default" : "secondary"}>{teacher.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(teacher)} aria-label="Edit teacher">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(teacher.id)} aria-label="Delete teacher">
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
