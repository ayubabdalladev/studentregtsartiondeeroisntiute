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

type TargetType = "CLASS" | "COURSE"

function getErrorMessage(error: any) {
  return error?.response?.data?.message ?? error?.message ?? "Something went wrong."
}

export default function MessagesCenter() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const [targetType, setTargetType] = useState<TargetType>("CLASS")
  const [classId, setClassId] = useState<string>("")
  const [courseId, setCourseId] = useState<string>("")

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [classesRes, coursesRes] = await Promise.all([
          api.get<ClassOption[]>("/api/classes"),
          api.get<any[]>("/api/courses"),
        ])

        setClasses(classesRes.data)
        setCourses(
          coursesRes.data.map((c) => ({
            id: c.id,
            name: c.name,
            classId: c.classId ?? null,
            status: c.status ?? "ACTIVE",
          })),
        )

        if (classesRes.data.length) setClassId((cur) => cur || classesRes.data[0].id)
        if (coursesRes.data.length) setCourseId((cur) => cur || coursesRes.data[0].id)
      } catch (e: any) {
        toast({ title: "Failed to load data", description: getErrorMessage(e), variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void run()
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
    } catch (e: any) {
      toast({ title: "Send failed", description: getErrorMessage(e), variant: "destructive" })
    } finally {
      setSending(false)
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Channel</Badge>
              <span className="text-sm text-muted-foreground">Email</span>
            </div>
            <div className="text-xs text-muted-foreground">{selectedHint}</div>
          </div>

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
                {!courses.length && <p className="text-xs text-muted-foreground">Create a course first.</p>}
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
        </Card>
      )}
    </div>
  )
}

