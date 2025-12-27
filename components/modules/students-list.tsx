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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
type StudentRow = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  gender: string | null
  paymentStatus: "PAID" | "UNPAID"
  isActive: boolean
  classId: string | null
  class: { id: string; name: string; level: string | null; isActive: boolean } | null
}

const NO_CLASS_VALUE = "__none__"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function StudentsList() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassId, setFilterClassId] = useState<string>("all")
  const [filterPayment, setFilterPayment] = useState<string>("all")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StudentRow | null>(null)
  const [saving, setSaving] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")
  const [classId, setClassId] = useState<string>(NO_CLASS_VALUE)
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID")
  const [isActive, setIsActive] = useState(true)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const resetForm = () => {
    setEditing(null)
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setGender("")
    setClassId(NO_CLASS_VALUE)
    setPaymentStatus("UNPAID")
    setIsActive(true)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (student: StudentRow) => {
    setEditing(student)
    setFirstName(student.firstName ?? "")
    setLastName(student.lastName ?? "")
    setEmail(student.email ?? "")
    setPhone(student.phone ?? "")
    setGender(student.gender ?? "")
    setClassId(student.classId ?? NO_CLASS_VALUE)
    setPaymentStatus(student.paymentStatus ?? "UNPAID")
    setIsActive(Boolean(student.isActive))
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

  const fetchStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterClassId !== "all") params.set("classId", filterClassId)
      if (filterPayment !== "all") params.set("paymentStatus", filterPayment)

      const url = params.toString() ? `/api/students?${params.toString()}` : "/api/students"
      const res = await api.get<StudentRow[]>(url)
      setStudents(res.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchClasses()
    void fetchStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void fetchStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClassId, filterPayment])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => {
      const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim().toLowerCase()
      return (
        fullName.includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q)
      )
    })
  }, [students, searchTerm])

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        gender: gender.trim() ? gender.trim() : null,
        classId: classId === NO_CLASS_VALUE ? null : classId,
        paymentStatus,
        isActive,
      }

      if (editing) {
        await api.patch(`/api/students/${editing.id}`, payload)
        toast({ title: "Student updated" })
      } else {
        await api.post("/api/students", payload)
        toast({ title: "Student created" })
      }

      setFormOpen(false)
      resetForm()
      await fetchStudents()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const prev = students
    setStudents((cur) => cur.filter((s) => s.id !== deleteId))
    try {
      await api.delete(`/api/students/${deleteId}`)
      toast({ title: "Student deleted" })
    } catch (e: any) {
      setStudents(prev)
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Student Management</h1>
          <p className="text-sm text-muted-foreground">Manage student records, class assignments, and payments.</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Student
        </Button>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search students..." className="pl-10" />
          </div>

          <div className="space-y-2">
            <Label>Filter by Class</Label>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger>
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filter by Payment</Label>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading students...
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No students found.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-0.5">
                        <div>
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {student.email ?? "—"} {student.phone ? `• ${student.phone}` : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{student.class?.name ?? "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge variant={student.paymentStatus === "PAID" ? "default" : "secondary"}>{student.paymentStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.isActive ? "default" : "secondary"}>{student.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(student)} aria-label="Edit student">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(student.id)}
                          aria-label="Delete student"
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
            <DialogTitle>{editing ? "Edit Student" : "Add Student"}</DialogTitle>
            <DialogDescription>{editing ? "Update student details." : "Create a new student record."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Input id="gender" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="optional" />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CLASS_VALUE}>Unassigned</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as "PAID" | "UNPAID")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="UNPAID">UNPAID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing && (
                <div className="flex items-center justify-between rounded-lg border p-3 h-[72px]">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Enable or disable this student.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </div>
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
                "Create Student"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
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
