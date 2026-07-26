"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceTrendPoint } from "@/services/dashboard.service";

interface AttendanceChartProps {
  data: AttendanceTrendPoint[];
}

export default function AttendanceChart({ data }: AttendanceChartProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Daily Attendance</h2>
        <p className="text-sm text-slate-500">Live trend for the selected filters.</p>
      </div>

      <div className="h-72 sm:h-80">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" stroke="#2563eb" strokeWidth={2.5} />
              <Line type="monotone" dataKey="absent" stroke="#f43f5e" strokeWidth={2.5} />
              <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            No attendance trend available for the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
