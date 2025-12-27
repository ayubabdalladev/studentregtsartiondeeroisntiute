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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Payments & Fees</h1>
          <p className="text-sm text-muted-foreground">Record payments and track revenue.</p>
        </div>
        <Button onClick={openDialog} className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Record Payment
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
        <Card className="p-4 sm:p-6">
          <p className="text-muted-foreground text-sm font-medium">Total Revenue (All Payments)</p>
          <p className="text-3xl font-bold text-chart-1 mt-2">{totalRevenue.toLocaleString()}</p>
        </Card>
        <Card className="p-4 sm:p-6">
          <p className="text-muted-foreground text-sm font-medium">Unpaid Students</p>
          <p className="text-3xl font-bold text-destructive mt-2">{(summary?.unpaidStudents ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">Monthly revenue: {(summary?.monthlyRevenue ?? 0).toLocaleString()}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : "—"}
                  </TableCell>
                  <TableCell>{payment.student?.class?.name ?? "—"}</TableCell>
                  <TableCell>
                    {payment.currency} {payment.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(payment.paidAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge>PAID</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !error && payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} {s.class ? `• ${s.class.name}` : ""}
                    </SelectItem>
                  ))}
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

