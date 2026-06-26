"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, DollarSign, AlertCircle, TrendingUp } from "lucide-react"

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

const selectContentClass = "z-[200] bg-background border shadow-xl"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value)
}

function formatPersonName(firstName: string, lastName: string) {
  const format = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  return `${format(firstName)} ${format(lastName)}`.trim()
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
      setSummary({
        unpaidStudents: summaryRes.data.unpaidStudents ?? 0,
        monthlyRevenue: summaryRes.data.monthlyRevenue ?? 0,
      })
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
      await api.post("/api/payments", {
        studentId: selectedStudentId,
        amount: numericAmount,
        note: note.trim() ? note.trim() : null,
      })
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
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#1E4497]/10 via-background to-[#EB4824]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#1E4497]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 border border-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <DollarSign className="w-3.5 h-3.5" />
                {payments.length} payment{payments.length === 1 ? "" : "s"}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700">
                {summary?.unpaidStudents ?? 0} unpaid
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Payments & Fees</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Record student payments, track revenue, and see who still owes fees.
            </p>
          </div>
          <Button
            onClick={openDialog}
            size="lg"
            className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 transition-all gap-2 px-6 shrink-0"
          >
            <Plus className="w-5 h-5" /> Record Payment
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground border-dashed shadow-sm">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading payments...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-sm bg-destructive/5 text-destructive border-destructive/20 shadow-sm">{error}</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden p-5 sm:p-6 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#1E4497]" />
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Collected</p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#1E4497] tabular-nums">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">All recorded payments</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1E4497]/10 text-[#1E4497]">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden p-5 sm:p-6 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(summary?.monthlyRevenue ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Monthly revenue</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden p-5 sm:p-6 border-muted/50 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-[#EB4824]" />
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unpaid Students</p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#EB4824] tabular-nums">
                    {(summary?.unpaidStudents ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Need payment</p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#EB4824]/10 text-[#EB4824]">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </div>

          <div className="rounded-xl border border-muted/50 bg-card shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b bg-muted/20">
              <h2 className="text-lg font-bold tracking-tight">Recent Payments</h2>
              <p className="text-sm text-muted-foreground">Latest fee records from students</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-4 pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground min-w-[200px]">
                      Student
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Class
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center w-[100px] pr-6">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                        No payments recorded yet. Tap &quot;Record Payment&quot; to add one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/40 transition-colors border-b-muted/40 last:border-0">
                        <TableCell className="py-4 pl-6 align-middle">
                          <div className="space-y-0.5">
                            <div className="text-base font-semibold text-foreground">
                              {payment.student
                                ? formatPersonName(payment.student.firstName, payment.student.lastName)
                                : "—"}
                            </div>
                            {payment.note && (
                              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{payment.note}</p>
                            )}
                            <div className="text-xs text-muted-foreground md:hidden flex flex-col gap-0.5 pt-1">
                              <span className="capitalize">{payment.student?.class?.name ?? "—"}</span>
                              <span>{new Date(payment.paidAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-4 align-middle">
                          {payment.student?.class?.name ? (
                            <Badge variant="outline" className="rounded-full capitalize border-primary/20 text-primary bg-primary/5 font-medium">
                              {payment.student.class.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 align-middle">
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatCurrency(payment.amount, payment.currency)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-4 text-sm text-muted-foreground align-middle">
                          {new Date(payment.paidAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="py-4 text-center align-middle pr-6">
                          <Badge className="inline-flex min-w-[72px] justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none px-3 py-1 text-xs font-semibold">
                            Paid
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Select an unpaid student and enter the amount. They will be marked as Paid.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-full h-11 bg-background">
                  <SelectValue placeholder="Select unpaid student" />
                </SelectTrigger>
                <SelectContent className={selectContentClass} position="popper">
                  <div className="px-2 pt-2 pb-1 border-b bg-background sticky top-0 z-10">
                    <Input
                      placeholder="Search student..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="h-9 bg-background"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredStudents.length ? (
                    filteredStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatPersonName(s.firstName, s.lastName)}
                        {s.class ? ` · ${s.class.name}` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">No unpaid students found</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="h-11 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. March fee"
                  className="h-11 bg-background"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={saving} className="rounded-full px-6">
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
