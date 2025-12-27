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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">Send emails to students by class or course (admin only).</p>
      </div>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Loading...
        </Card>
      ) : (
        <Card className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Channel</Badge>
              <span className="text-sm text-muted-foreground">Email</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-xs text-muted-foreground">
                Classes: {classes.length} • Courses: {courses.length}
              </span>
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")} disabled={reloading}>
                {reloading ? (
                  <>
                    <Spinner className="mr-2" />
                    Refreshing...
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </div>

          {selectedHint ? <div className="text-xs text-muted-foreground">{selectedHint}</div> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                <SelectTrigger>
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
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
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
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger>
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
                    No courses found. Create one in <a className="underline" href="/courses">Courses</a>, then press Refresh.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New class announcement" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Emails are sent to students with a valid email on their profile.</p>
          </div>

          <div className="flex justify-end">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={loadFailures} disabled={sending || loading || loadingFailures}>
                {loadingFailures ? (
                  <>
                    <Spinner className="mr-2" />
                    Loading...
                  </>
                ) : (
                  "View Failures"
                )}
              </Button>
              <Button onClick={send} disabled={sending || loading}>
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

          {failures.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Recent failed emails</p>
              <div className="space-y-2">
                {failures.map((f) => (
                  <div key={f.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{f.to ?? "—"}</span> • {f.subject ?? "—"} • {f.error ?? "Unknown error"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
