"use client"

import { useEffect, useMemo, useState } from "react"
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

type TargetType = "CLASS" | "COURSE"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function MessagesCenter() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [reloading, setReloading] = useState(false)

  const [targetType, setTargetType] = useState<TargetType>("CLASS")
  const [classId, setClassId] = useState<string>("")
  const [courseId, setCourseId] = useState<string>("")

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [failures, setFailures] = useState<EmailLogRow[]>([])
  const [loadingFailures, setLoadingFailures] = useState(false)

  const load = async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true)
    if (mode === "refresh") setReloading(true)
    try {
      const [classesRes, coursesRes] = await Promise.all([
        api.get<ClassOption[]>("/api/classes"),
        api.get<any[]>("/api/courses"),
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

      if (nextClasses.length) setClassId((cur) => cur || nextClasses[0].id)
      if (nextCourses.length) setCourseId((cur) => cur || nextCourses[0].id)
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

  const selectedHint = useMemo(() => {
    if (targetType === "COURSE") {
      const course = courses.find((c) => c.id === courseId)
      return course ? `Course: ${course.name}` : ""
    }
    const cls = classes.find((c) => c.id === classId)
    return cls ? `Class: ${cls.name}` : ""
  }, [targetType, classId, courseId, classes, courses])

  const send = async () => {
    if (!subject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" })
      return
    }
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" })
      return
    }

    const payload =
      targetType === "COURSE"
        ? { courseId, subject: subject.trim(), message: message.trim() }
        : { classId, subject: subject.trim(), message: message.trim() }

    if (targetType === "COURSE" && !courseId) {
      toast({ title: "Select a course", variant: "destructive" })
      return
    }
    if (targetType === "CLASS" && !classId) {
      toast({ title: "Select a class", variant: "destructive" })
      return
    }

    setSending(true)
    try {
      const res = await api.post<{ sent: number; skipped: number; failed: number; total: number }>(
        "/api/notifications/email/broadcast",
        payload,
      )
      toast({
        title: "Messages sent",
        description: `Total: ${res.data.total} • Sent: ${res.data.sent} • Skipped: ${res.data.skipped} • Failed: ${res.data.failed}`,
      })
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
      if (!res.data.length) toast({ title: "No failures found", description: "Last 20 email sends have no FAILED status." })
    } catch (e: any) {
      toast({ title: "Failed to load logs", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setLoadingFailures(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Messages</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Send email notifications to students by class or course.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground border border-dashed rounded-xl bg-card/50">
          <Spinner className="w-8 h-8 text-primary" />
          <span>Loading channels...</span>
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 sm:p-6 border-b bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-background text-foreground/80 font-medium px-2.5 py-1">Channel: Email</Badge>
              {selectedHint ? <span className="text-sm text-muted-foreground font-medium">{selectedHint}</span> : null}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active: {classes.length} Classes • {courses.length} Courses
              </span>
              <Button variant="ghost" size="sm" onClick={() => void load("refresh")} disabled={reloading} className="h-8 hover:bg-background/80">
                {reloading ? (
                  <>
                    <Spinner className="mr-2 w-3 h-3" />
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Type</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                  <SelectTrigger className="h-11 rounded-lg border-muted shadow-sm">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLASS">Class</SelectItem>
                    <SelectItem value="COURSE">Course</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === "CLASS" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger className="h-11 rounded-lg border-muted shadow-sm">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!classes.length && <p className="text-xs text-muted-foreground">Create a class first.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="h-11 rounded-lg border-muted shadow-sm">
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!courses.length && (
                    <p className="text-xs text-muted-foreground">
                      No courses found. Create one in <a className="underline hover:text-primary transition-colors" href="/courses">Courses</a>.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Important Announcement: Exam Schedule"
                className="h-11 rounded-lg border-muted shadow-sm focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message Content</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={8}
                className="resize-y min-h-[150px] rounded-lg border-muted shadow-sm focus-visible:ring-primary/20 p-4"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500/50 inline-block"></span>
                Recipients must have a valid email address in their profile.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 border-t border-dashed">
              <Button
                variant="ghost"
                onClick={loadFailures}
                disabled={sending || loading || loadingFailures}
                className="text-muted-foreground hover:text-foreground"
              >
                {loadingFailures ? (
                  <>
                    <Spinner className="mr-2" />
                    Loading logs...
                  </>
                ) : (
                  "View Recent Failures"
                )}
              </Button>
              <Button
                onClick={send}
                disabled={sending || loading}
                className="w-full sm:w-auto shadow-lg hover:shadow-primary/25 transition-all px-8"
              >
                {sending ? (
                  <>
                    <Spinner className="mr-2" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {failures.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-destructive">Recent Delivery Failures</p>
            <span className="text-xs text-muted-foreground">Last 20 attempts</span>
          </div>
          <div className="divide-y divide-destructive/10">
            {failures.map((f) => (
              <div key={f.id} className="text-xs text-muted-foreground py-2 flex items-start gap-2">
                <span className="font-medium text-foreground whitespace-nowrap">{f.to ?? "—"}</span>
                <span className="text-destructive/80">•</span>
                <span className="truncate flex-1">{f.subject ?? "—"}</span>
                <span className="text-destructive font-medium whitespace-nowrap">{f.error ?? "Unknown error"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
