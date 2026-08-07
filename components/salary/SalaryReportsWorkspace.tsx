"use client";

import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { getAttendanceForCycleWindow } from "@/services/attendanceVerification.service";
import { subscribeEmployees } from "@/services/employee.service";
import { exportExcel, exportPDF } from "@/services/dashboard.service";
import { subscribeSalaryCycles } from "@/services/salaryCycle.service";
import { getSalaryRecordsForCycle } from "@/services/salaryRecord.service";
import {
  getAttendanceExceptionReportRows,
  getEmployeeSalaryReportRows,
  getGodownSalaryReportRows,
  getSalarySummaryReportRow,
} from "@/services/salaryReports.service";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { SalaryCycle, SalaryRecord } from "@/types/salary";

const reportTypes = [
  { value: "employee-salary", label: "Employee Salary Report" },
  { value: "godown-salary", label: "Godown Salary Report" },
  { value: "salary-summary", label: "Salary Summary" },
  { value: "attendance-exceptions", label: "Attendance Exception Report" },
] as const;

type ReportType = (typeof reportTypes)[number]["value"];

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function SalaryReportsWorkspace() {
  const [cycles, setCycles] = useState<SalaryCycle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("employee-salary");
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const unsubscribeCycles = subscribeSalaryCycles((next) => {
      setCycles(next);
      setCycleId((current) => current || next[0]?.id || "");
    });
    const unsubscribeEmployees = subscribeEmployees(setEmployees);
    return () => {
      unsubscribeCycles();
      unsubscribeEmployees();
    };
  }, []);

  const cycle = useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);

  useEffect(() => {
    if (!cycle?.id) return;
    Promise.all([getSalaryRecordsForCycle(cycle.id), getAttendanceForCycleWindow(cycle.fromDate, cycle.toDate)]).then(
      ([recordRows, attendanceRows]) => {
        setRecords(recordRows);
        setAttendance(attendanceRows);
      }
    );
  }, [cycle]);

  const pendingCorrections = useMemo(() => attendance.filter((a) => a.isPendingCorrection), [attendance]);

  const { rows, headers, title } = useMemo(() => {
    switch (reportType) {
      case "godown-salary": {
        const data = getGodownSalaryReportRows(records);
        return { rows: data, headers: Object.keys(data[0] ?? { Godown: "", Employees: "", "Total Hours": "", "Total Salary": "" }), title: "Godown Salary Report" };
      }
      case "salary-summary": {
        const data = [getSalarySummaryReportRow(records, pendingCorrections)];
        return { rows: data, headers: Object.keys(data[0]), title: "Salary Summary" };
      }
      case "attendance-exceptions": {
        const data = getAttendanceExceptionReportRows(attendance, records, employees);
        return {
          rows: data,
          headers: ["Category", "Employee ID", "Employee Name", "Date", "Detail"],
          title: "Attendance Exception Report",
        };
      }
      case "employee-salary":
      default: {
        const data = getEmployeeSalaryReportRows(records);
        return {
          rows: data,
          headers: [
            "Employee ID",
            "Employee Name",
            "Godown",
            "Worked Hours",
            "Payable Hours",
            "Hourly Rate",
            "Gross Salary",
            "Override Hours",
            "Final Salary",
          ],
          title: "Employee Salary Report",
        };
      }
    }
  }, [reportType, records, attendance, employees, pendingCorrections]);

  const payload = {
    title: `${title} — ${cycle ? `${formatDateLabel(cycle.fromDate)} to ${formatDateLabel(cycle.toDate)}` : ""}`,
    // ExportReportPayload's row values are string | number | boolean | null | undefined;
    // report rows are plain records of those types already, this just satisfies the
    // structural type without a runtime transform.
    rows: rows as unknown as Array<Record<string, string | number | boolean | null | undefined>>,
    headers,
    reportType: reportType,
    filters: { cycleId, fromDate: cycle?.fromDate, toDate: cycle?.toDate },
  };

  return (
    <AppCard title="Salary Reports">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium">Salary Cycle</span>
          <select
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {formatDateLabel(c.fromDate)} – {formatDateLabel(c.toDate)} ({c.status})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
          <span className="font-medium">Report Type</span>
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value as ReportType)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
          >
            {reportTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <Button variant="outline" className="w-full" onClick={() => exportExcel(payload)} disabled={rows.length === 0}>
            Export Excel
          </Button>
          <Button className="w-full" onClick={() => exportPDF(payload)} disabled={rows.length === 0}>
            Export PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/95 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8 text-center text-sm text-slate-500">
                  No data for this cycle.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {headers.map((header) => (
                    <td key={header} className="px-3 py-3">
                      {String((row as unknown as Record<string, unknown>)[header] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
