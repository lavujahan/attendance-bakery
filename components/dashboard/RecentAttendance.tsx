"use client";

import type { AttendanceRecord } from "@/types/attendance";

interface RecentAttendanceProps {
  records: AttendanceRecord[];
}

const faceStatusStyle: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  unverified: "bg-amber-50 text-amber-700",
  service_error: "bg-amber-50 text-amber-700",
};

export default function RecentAttendance({ records }: RecentAttendanceProps) {
  const sortedRecords = [...records].sort((left, right) => {
    const leftDate = left.attendanceDate ?? "";
    const rightDate = right.attendanceDate ?? "";
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    return (right.createdAt ? 1 : 0) - (left.createdAt ? 1 : 0);
  });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Attendance</h2>
        <p className="text-sm text-slate-500">Newest entries first.</p>
      </div>

      <div className="space-y-3">
        {sortedRecords.slice(0, 8).map((item) => (
          <div
            key={item.id ?? `${item.employeeId}-${item.attendanceDate}`}
            className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{item.employeeName}</p>
              <p className="text-sm text-slate-500">
                {item.siteName} • {item.attendanceDate}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <p className="text-sm font-semibold text-slate-900">{item.checkInTime ?? "—"}</p>
              <p className="text-xs text-slate-500">{item.status}</p>
              {item.checkInFaceStatus && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${faceStatusStyle[item.checkInFaceStatus]}`}>
                  {item.checkInFaceStatus}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
