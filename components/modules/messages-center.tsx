"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquare, Mail, Send, Users, BookOpen, User, RefreshCw, AlertTriangle } from "lucide-react"

import { api } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"

type ClassOption = { id: string; name: string; level: string | null; isActive: boolean }
type CourseOption = { id: string; name: string; classId: string | null; status: string }
type EmailLogRow = {
  id: string
  to: string | null
  subject: string | null
  status: string | null
  error: string | null
  createdAt: string | null
}

type TargetType = "CLASS" | "COURSE" | "SINGLE"
type MessageMode = "EMAIL" | "WHATSAPP"

type StudentOption = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  class?: { name: string } | null
}

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

export default function MessagesCenter() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [reloading, setReloading] = useState(false)

  const [mode, setMode] = useState<MessageMode>("WHATSAPP")
  const [targetType, setTargetType] = useState<TargetType>("CLASS")
  const [classId, setClassId] = useState<string>("")
  const [courseId, setCourseId] = useState<string>("")
  const [studentId, setStudentId] = useState<string>("")

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [failures, setFailures] = useState<EmailLogRow[]>([])
  const [loadingFailures, setLoadingFailures] = useState(false)

  const load = async (loadMode: "initial" | "refresh") => {
    if (loadMode === "initial") setLoading(true)
    if (loadMode === "refresh") setReloading(true)
    try {
      const [classesRes, coursesRes, studentsRes] = await Promise.all([
        api.get<ClassOption[]>("/api/classes"),
        api.get<any[]>("/api/courses"),
        api.get<StudentOption[]>("/api/students"),
      ])

      const nextClasses = classesRes.data
      const nextCourses = (Array.isArray(coursesRes.data) ? coursesRes.data : []).map((c) => ({
        id: c.id,
        name: c.name,
        classId: c.classId ?? null,
        status: c.status ?? "ACTIVE",
      }))

      setClasses(nextClasses)
      setCourses(nextCourses)
      setStudents(studentsRes.data)

      if (nextClasses.length) setClassId((cur) => cur || nextClasses[0].id)
      if (nextCourses.length) setCourseId((cur) => cur || nextCourses[0].id)
      if (studentsRes.data.length) setStudentId((cur) => cur || studentsRes.data[0].id)
    } catch (e: any) {
      toast({ title: "Failed to load data", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoading(false)
      setReloading(false)
    }
  }

  useEffect(() => {
    void load("initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recipientSummary = useMemo(() => {
    if (targetType === "COURSE") {
      const course = courses.find((c) => c.id === courseId)
      return course ? `All students in course "${course.name}"` : "Select a course"
    }
    if (targetType === "SINGLE") {
      const student = students.find((s) => s.id === studentId)
      if (!student) return "Select a student"
      const contact = mode === "WHATSAPP" ? student.phone : student.email
      return `${formatPersonName(student.firstName, student.lastName)}${contact ? ` · ${contact}` : " · no contact info"}`
    }
    const cls = classes.find((c) => c.id === classId)
    return cls ? `All students in class "${cls.name}"` : "Select a class"
  }, [targetType, classId, courseId, studentId, classes, courses, students, mode])

  const send = async () => {
    if (mode === "EMAIL" && !subject.trim()) {
      toast({ title: "Add a subject", description: "Email messages need a subject line.", variant: "destructive" })
      return
    }
    if (!message.trim()) {
      toast({ title: "Write your message", description: "The message body cannot be empty.", variant: "destructive" })
      return
    }

    setSending(true)
    try {
      if (targetType === "SINGLE") {
        const endpoint = mode === "EMAIL" ? "/api/notifications/email/single" : "/api/notifications/whatsapp/single"
        const payload =
          mode === "EMAIL"
            ? { studentId, subject: subject.trim(), message: message.trim() }
            : { studentId, message: message.trim() }

        await api.post(endpoint, payload)
        toast({
          title: "Message sent",
          description: `${mode === "WHATSAPP" ? "WhatsApp" : "Email"} delivered to the student.`,
        })
      } else {
        const endpoint =
          mode === "EMAIL" ? "/api/notifications/email/broadcast" : "/api/notifications/whatsapp/broadcast"

        const payload =
          targetType === "COURSE"
            ? { courseId, subject: subject.trim(), message: message.trim() }
            : { classId, subject: subject.trim(), message: message.trim() }

        const res = await api.post<{ sent: number; skipped: number; failed: number; total: number }>(endpoint, payload)
        toast({
          title: "Broadcast complete",
          description: `Sent: ${res.data.sent} · Skipped: ${res.data.skipped} · Failed: ${res.data.failed}`,
        })
      }
      setSubject("")
      setMessage("")
      setFailures([])
    } catch (e: any) {
      toast({ title: "Send failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const loadFailures = async () => {
    setLoadingFailures(true)
    try {
      const res = await api.get<EmailLogRow[]>("/api/notifications/email/logs?status=FAILED&limit=20")
      setFailures(res.data)
      if (!res.data.length) toast({ title: "All good", description: "No failed emails in the last 20 attempts." })
    } catch (e: any) {
      toast({ title: "Failed to load logs", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingFailures(false)
    }
  }

  const targetOptions = [
    { value: "CLASS" as const, label: "Whole Class", icon: Users, desc: "Send to everyone in a class" },
    { value: "COURSE" as const, label: "Course", icon: BookOpen, desc: "Send to a course group" },
    { value: "SINGLE" as const, label: "One Student", icon: User, desc: "Send to one person only" },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-[#1E4497]/10 via-background to-[#EB4824]/5 p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#1E4497]/10 blur-3xl" />
        <div className="relative space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full bg-background/80 border-primary/20 text-primary font-medium">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Messaging
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {classes.length} classes · {students.length} students
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Send a Message</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            Choose WhatsApp or Email, pick who receives it, write your message, and send.
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 border-dashed flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Spinner className="w-8 h-8 text-primary" />
          <p>Loading...</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Step 1: Channel */}
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b bg-muted/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 1</p>
              <h2 className="text-lg font-semibold">How do you want to send?</h2>
            </div>
            <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("WHATSAPP")}
                className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  mode === "WHATSAPP"
                    ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                    : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${mode === "WHATSAPP" ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">WhatsApp</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Student must have a phone number</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("EMAIL")}
                className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  mode === "EMAIL"
                    ? "border-[#1E4497] bg-[#1E4497]/5 shadow-sm"
                    : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${mode === "EMAIL" ? "bg-[#1E4497] text-white" : "bg-muted text-muted-foreground"}`}>
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Student must have an email address</p>
                </div>
              </button>
            </div>
          </Card>

          {/* Step 2: Recipients */}
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b bg-muted/20 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 2</p>
                <h2 className="text-lg font-semibold">Who receives this?</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void load("refresh")} disabled={reloading} className="rounded-full h-8">
                {reloading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
            <div className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {targetOptions.map((opt) => {
                  const Icon = opt.icon
                  const active = targetType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTargetType(opt.value)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        active ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/30"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  )
                })}
              </div>

              {targetType === "CLASS" && (
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger className="w-full h-11 bg-background">
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass} position="popper">
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!classes.length && <p className="text-sm text-muted-foreground">Create a class first.</p>}
                </div>
              )}

              {targetType === "COURSE" && (
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="w-full h-11 bg-background">
                      <SelectValue placeholder="Choose a course" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass} position="popper">
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!courses.length && <p className="text-sm text-muted-foreground">No courses found.</p>}
                </div>
              )}

              {targetType === "SINGLE" && (
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger className="w-full h-11 bg-background">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass} position="popper">
                      {students.map((s) => {
                        const hasContact = mode === "WHATSAPP" ? Boolean(s.phone) : Boolean(s.email)
                        return (
                          <SelectItem key={s.id} value={s.id} disabled={!hasContact}>
                            {formatPersonName(s.firstName, s.lastName)}
                            {s.class ? ` · ${s.class.name}` : ""}
                            {!hasContact && (mode === "WHATSAPP" ? " (no phone)" : " (no email)")}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-xl bg-muted/40 border border-muted px-4 py-3 text-sm">
                <span className="text-muted-foreground">Sending to: </span>
                <span className="font-medium text-foreground">{recipientSummary}</span>
              </div>
            </div>
          </Card>

          {/* Step 3: Compose */}
          <Card className="border-muted/50 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b bg-muted/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Step 3</p>
              <h2 className="text-lg font-semibold">Write your message</h2>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              {mode === "EMAIL" && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Exam schedule update"
                    className="h-11 bg-background"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="message">Message</Label>
                  <span className="text-xs text-muted-foreground">Tip: type [[name]] to use the student&apos;s name</span>
                </div>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    mode === "WHATSAPP"
                      ? "Hello [[name]], this is a reminder about tomorrow's class..."
                      : "Dear [[name]],\n\nPlease note that..."
                  }
                  rows={6}
                  className="min-h-[160px] resize-y bg-background text-base leading-relaxed p-4"
                />
                <p className="text-xs text-muted-foreground">{message.length} characters</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-dashed">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadFailures}
                  disabled={sending || loadingFailures || mode !== "EMAIL"}
                  className="text-muted-foreground rounded-full"
                >
                  {loadingFailures ? (
                    <>
                      <Spinner className="mr-2 w-4 h-4" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 w-4 h-4" />
                      View failed emails
                    </>
                  )}
                </Button>
                <Button
                  onClick={send}
                  disabled={sending || !message.trim() || (mode === "EMAIL" && !subject.trim())}
                  size="lg"
                  className="w-full sm:w-auto rounded-full shadow-lg hover:shadow-primary/25 gap-2 px-8"
                >
                  {sending ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send {mode === "WHATSAPP" ? "WhatsApp" : "Email"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {failures.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-destructive/10 flex items-center justify-between">
            <p className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Failed email deliveries
            </p>
            <span className="text-xs text-muted-foreground">Last 20 attempts</span>
          </div>
          <div className="divide-y divide-destructive/10">
            {failures.map((f) => (
              <div key={f.id} className="px-5 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="font-medium text-foreground">{f.to ?? "—"}</span>
                <span className="text-muted-foreground truncate flex-1">{f.subject ?? "—"}</span>
                <span className="text-destructive text-xs font-medium">{f.error ?? "Unknown error"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
