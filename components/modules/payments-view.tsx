"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ReportsSummary = {
  unpaidStudents: number
  monthlyRevenue: number
}

type PaymentRow = {
  id: string
  amount: number
  currency: string
  paidAt: string
  note: string | null
  student: {
    id: string
    firstName: string
    lastName: string
    class: { id: string; name: string; level: string | null } | null
  } | null
}

type StudentOption = {
  id: string
  firstName: string
  lastName: string
  class: { id: string; name: string; level: string | null } | null
}

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function PaymentsView() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [students, setStudents] = useState<StudentOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [studentSearch, setStudentSearch] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, paymentsRes] = await Promise.all([
        api.get("/api/reports/summary"),
        api.get<PaymentRow[]>("/api/payments?limit=100"),
      ])
      setSummary({ unpaidStudents: summaryRes.data.unpaidStudents ?? 0, monthlyRevenue: summaryRes.data.monthlyRevenue ?? 0 })
      setPayments(paymentsRes.data)
    } catch (e: any) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const openDialog = async () => {
    setDialogOpen(true)
    setSelectedStudentId("")
    setAmount("")
    setNote("")
    setStudentSearch("")

    try {
      const res = await api.get<Array<any>>("/api/students?paymentStatus=UNPAID")
      setStudents(
        res.data.map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          class: s.class ?? null,
        })),
      )
    } catch (e: any) {
      toast({ title: "Failed to load unpaid students", description: getErrorMessage(e), variant: "destructive" })
    }
  }

  const totalRevenue = useMemo(() => payments.reduce((sum, p) => sum + (p.amount ?? 0), 0), [payments])

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students
    const term = studentSearch.toLowerCase()
    return students.filter((s) => {
      const fullName = `${s.firstName} ${s.lastName}`
      const className = s.class?.name ?? ""
      return `${fullName} ${className}`.toLowerCase().includes(term)
    })
  }, [students, studentSearch])

  const submitPayment = async () => {
    if (!selectedStudentId) {
      toast({ title: "Select a student", variant: "destructive" })
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await api.post("/api/payments", { studentId: selectedStudentId, amount: numericAmount, note: note.trim() ? note.trim() : null })
      toast({ title: "Payment recorded" })
      setDialogOpen(false)
      await fetchData()
    } catch (e: any) {
      toast({ title: "Save failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Payments & Fees</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Record student payments and track revenue streams.</p>
        </div>
        <Button onClick={openDialog} size="lg" className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6">
          <Plus className="w-5 h-5" /> Record Payment
        </Button>
      </div>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading payments...
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Revenue</p>
            <p className="text-4xl font-extrabold text-primary tabular-nums mt-2">{totalRevenue.toLocaleString()}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed">
            <p className="text-xs text-muted-foreground">Total collected from all recorded payments.</p>
          </div>
        </Card>
        <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Unpaid Students</p>
              <p className="text-4xl font-extrabold text-destructive tabular-nums mt-2">{(summary?.unpaidStudents ?? 0).toLocaleString()}</p>
            </div>
            <Badge variant="outline" className="text-xs font-normal border-destructive/20 text-destructive bg-destructive/5">Needs Attention</Badge>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Monthly revenue target</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{(summary?.monthlyRevenue ?? 0).toLocaleString()}</p>
          </div>
        </Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Student</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Class</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} className="group hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                  <TableCell className="py-4 pl-6 font-medium">
                    <div className="space-y-0.5">
                      <div className="text-base text-foreground font-semibold">{payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : "—"}</div>
                      <div className="text-xs text-muted-foreground md:hidden flex flex-col gap-1">
                        <span>{payment.student?.class?.name ?? "—"}</span>
                        <span className="font-mono">{new Date(payment.paidAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-4 text-muted-foreground">{payment.student?.class?.name ?? "—"}</TableCell>
                  <TableCell className="py-4">
                    <span className="font-mono font-medium text-foreground">{payment.currency} {payment.amount.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground font-mono">{new Date(payment.paidAt).toLocaleDateString()}</TableCell>
                  <TableCell className="py-4 text-right pr-6">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-none px-3 font-semibold rounded-full">PAID</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !error && payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-sm border-dashed">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Create a payment and automatically mark the student as PAID.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an unpaid student" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pt-2 pb-1 border-b bg-background">
                    <Input
                      autoFocus
                      placeholder="Search student..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  {filteredStudents.length ? (
                    filteredStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} {s.class ? `• ${s.class.name}` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No students found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : (
                "Record"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
