"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react"

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
const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatPersonName(firstName: string, lastName: string) {
  const format = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${format(firstName)} ${format(lastName)}`.trim()
}

function paymentLabel(status: "PAID" | "UNPAID") {
  return status === "PAID" ? "Paid" : "Unpaid"
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
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({})
  const [paymentUpdating, setPaymentUpdating] = useState<Record<string, boolean>>({})

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
        toast({ title: "Student updated successfully" })
      } else {
        await api.post("/api/students", payload)
        toast({ title: "Student created successfully" })
      }

      setFormOpen(false)
      resetForm()
      await fetchStudents()
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        setFormOpen(false)
        resetForm()
        await fetchStudents()
      } else {
        toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
      }
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
      toast({ title: "Student deleted successfully" })
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        await fetchStudents()
      } else {
        setStudents(prev)
        toast({ title: "Delete failed", description: getErrorMessage(e), variant: "destructive" })
      }
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const toggleStudentStatus = async (student: StudentRow) => {
    if (statusUpdating[student.id]) return
    const nextIsActive = !student.isActive
    const prevIsActive = student.isActive

    setStatusUpdating((cur) => ({ ...cur, [student.id]: true }))
    setStudents((cur) => cur.map((s) => (s.id === student.id ? { ...s, isActive: nextIsActive } : s)))

    try {
      await api.patch(`/api/students/${student.id}`, {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email ?? null,
        phone: student.phone ?? null,
        gender: student.gender ?? null,
        classId: student.classId,
        paymentStatus: student.paymentStatus,
        isActive: nextIsActive,
      })
      toast({ title: nextIsActive ? "Student is now ACTIVE" : "Student is now INACTIVE" })
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 404) {
        // Student no longer exists – refresh list to reflect backend
        setStudents((cur) => cur.filter((s) => s.id !== student.id))
        toast({ title: "Student not found", description: "Refreshing student list...", variant: "destructive" })
        await fetchStudents()
      } else {
        setStudents((cur) => cur.map((s) => (s.id === student.id ? { ...s, isActive: prevIsActive } : s)))
        toast({ title: "Update failed", description: getErrorMessage(e), variant: "destructive" })
      }
    } finally {
      setStatusUpdating((cur) => {
        const next = { ...cur }
        delete next[student.id]
        return next
      })
    }
  }

  const togglePaymentStatus = async (student: StudentRow) => {
    if (paymentUpdating[student.id]) return
    const nextStatus = student.paymentStatus === "PAID" ? "UNPAID" : "PAID"
    const prevStatus = student.paymentStatus

    setPaymentUpdating((cur) => ({ ...cur, [student.id]: true }))
    setStudents((cur) => cur.map((s) => (s.id === student.id ? { ...s, paymentStatus: nextStatus } : s)))

    try {
      await api.patch(`/api/students/${student.id}`, {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        gender: student.gender,
        classId: student.classId,
        paymentStatus: nextStatus,
        isActive: student.isActive,
      })
      toast({ title: `Payment status updated to ${nextStatus}` })
    } catch (e: any) {
      setStudents((cur) => cur.map((s) => (s.id === student.id ? { ...s, paymentStatus: prevStatus } : s)))
      toast({ title: "Update failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setPaymentUpdating((cur) => {
        const next = { ...cur }
        delete next[student.id]
        return next
      })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#1E4497]/10 via-background to-[#EB4824]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#1E4497]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <Users className="w-3.5 h-3.5" />
              {filtered.length} student{filtered.length === 1 ? "" : "s"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Student Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Manage student records, class assignments, and payments.
            </p>
          </div>
          <Button onClick={openCreate} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0">
            <Plus className="w-5 h-5" /> Add Student
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border-muted/50 shadow-sm gap-0">
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="flex flex-1 flex-col gap-2 min-w-0 w-full sm:basis-0">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search</Label>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, email, or phone..."
                className="w-full pl-10 h-11 rounded-lg bg-background border-muted shadow-sm focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 min-w-0 w-full sm:basis-0">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class</Label>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-2 min-w-0 w-full sm:basis-0">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment</Label>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="h-11 w-full rounded-lg bg-background border-muted shadow-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent className={selectContentClass} position="popper">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading students...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <div className="p-4 rounded-full bg-muted">
            <Search className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">No students found</p>
          <p className="text-sm">Try adjusting your filters or search query.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[240px]">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell min-w-[140px]">Class</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[120px]">Payment</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[120px]">Status</TableHead>
                  <TableHead className="text-right pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                    <TableCell className="py-4 pl-6">
                      <div className="space-y-1">
                        <div className="text-base text-foreground font-semibold tracking-tight">
                          {formatPersonName(student.firstName, student.lastName)}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                          <span className="truncate max-w-[220px]">{student.email || "No email"}</span>
                          {student.phone && (
                            <>
                              <span className="hidden sm:inline text-muted-foreground/40">•</span>
                              <span className="font-mono">{student.phone}</span>
                            </>
                          )}
                        </div>
                        <div className="md:hidden pt-1">
                          <Badge variant="outline" className="rounded-full font-normal capitalize">
                            {student.class?.name ?? "Unassigned"}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-4 align-middle">
                      {student.class?.name ? (
                        <Badge variant="outline" className="rounded-full font-medium capitalize border-primary/20 text-primary bg-primary/5">
                          {student.class.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          student.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                        } ${paymentUpdating[student.id] ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                      >
                        <button
                          type="button"
                          onClick={() => togglePaymentStatus(student)}
                          disabled={paymentUpdating[student.id]}
                          title="Click to toggle payment status"
                        >
                          {paymentLabel(student.paymentStatus)}
                        </button>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-center">
                      <Badge
                        asChild
                        variant="secondary"
                        className={`inline-flex min-w-[88px] justify-center rounded-full shadow-none px-3 py-1 text-xs font-semibold transition ${
                          student.isActive
                            ? "bg-[#1E4497]/10 text-[#1E4497] hover:bg-[#1E4497]/15 border border-[#1E4497]/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                        } ${statusUpdating[student.id] ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleStudentStatus(student)}
                          disabled={statusUpdating[student.id]}
                          aria-pressed={student.isActive}
                          title="Click to toggle active status"
                        >
                          {student.isActive ? "Active" : "Inactive"}
                        </button>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6 align-middle">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(student)}
                          aria-label="Edit student"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(student.id)}
                          aria-label="Delete student"
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
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender" className="w-full bg-background">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass} position="popper">
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass} position="popper">
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
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass} position="popper">
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 h-[72px]">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Enable or disable this student.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
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
