"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

const mockAttendance = [
  { id: 1, class: "10-A", date: "2024-12-20", presentCount: 32, absentCount: 3, total: 35, percentage: "91%" },
  { id: 2, class: "10-B", date: "2024-12-20", presentCount: 34, absentCount: 2, total: 36, percentage: "94%" },
  { id: 3, class: "11-A", date: "2024-12-20", presentCount: 30, absentCount: 2, total: 32, percentage: "94%" },
  { id: 4, class: "11-B", date: "2024-12-20", presentCount: 27, absentCount: 1, total: 28, percentage: "96%" },
]

export default function AttendanceView() {
  const [attendanceData, setAttendanceData] = useState(mockAttendance)
  const [selectedClass, setSelectedClass] = useState("")

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Attendance Management</h1>
        <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <select className="w-full sm:w-auto px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
          <option>All Classes</option>
          {["10-A", "10-B", "11-A", "11-B"].map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="w-full sm:w-auto px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Attendance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {attendanceData.map((record) => (
          <Card key={record.id} className="p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{record.class}</h3>
                <p className="text-sm text-muted-foreground">{record.date}</p>
              </div>
              <span className="text-2xl font-bold text-chart-1">{record.percentage}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Present: {record.presentCount}</span>
                <span className="text-chart-1 font-medium">{record.presentCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Absent: {record.absentCount}</span>
                <span className="text-destructive font-medium">{record.absentCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Total: {record.total}</span>
                <span className="text-muted-foreground font-medium">{record.total}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
