// Pure row-builder functions, same shape as services/dashboard.service.ts's report
// builders (arrays + filters in, row arrays out). Excel/PDF export reuses
// dashboard.service.ts's exportExcel/exportPDF directly -- ExportReportPayload is already
// generic enough that duplicating that jsPDF/xlsx boilerplate here would add nothing.
import { isLateArrival } from "@/lib/attendanceMath";
import { minutesToDecimalHours } from "@/lib/payrollMath";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { SalaryRecord } from "@/types/salary";

export interface EmployeeSalaryReportRow {
  "Employee ID": string;
  "Employee Name": string;
  Godown: string;
  "Worked Hours": number;
  "Payable Hours": number;
  "Hourly Rate": number;
  "Gross Salary": number;
  "Override Hours": number | string;
  "Final Salary": number;
}

export function getEmployeeSalaryReportRows(records: SalaryRecord[]): EmployeeSalaryReportRow[] {
  return records.map((record) => ({
    "Employee ID": record.employeeCode,
    "Employee Name": record.employeeName,
    Godown: record.siteName,
    "Worked Hours": minutesToDecimalHours(record.workedMinutes),
    "Payable Hours": minutesToDecimalHours(record.payableMinutes),
    "Hourly Rate": record.hourlyRate,
    "Gross Salary": record.grossSalaryAmount,
    "Override Hours":
      record.overridePayableMinutes !== undefined ? minutesToDecimalHours(record.overridePayableMinutes) : "—",
    "Final Salary": record.finalSalaryAmount,
  }));
}

export interface GodownSalaryReportRow {
  Godown: string;
  Employees: number;
  "Total Hours": number;
  "Total Salary": number;
}

export function getGodownSalaryReportRows(records: SalaryRecord[]): GodownSalaryReportRow[] {
  const bySite = new Map<string, { employees: Set<string>; totalMinutes: number; totalSalary: number }>();

  for (const record of records) {
    const key = record.siteName;
    const bucket = bySite.get(key) ?? { employees: new Set<string>(), totalMinutes: 0, totalSalary: 0 };
    bucket.employees.add(record.employeeCode);
    bucket.totalMinutes += record.finalPayableMinutes;
    bucket.totalSalary += record.finalSalaryAmount;
    bySite.set(key, bucket);
  }

  return Array.from(bySite.entries()).map(([siteName, bucket]) => ({
    Godown: siteName,
    Employees: bucket.employees.size,
    "Total Hours": minutesToDecimalHours(bucket.totalMinutes),
    "Total Salary": Math.round(bucket.totalSalary * 100) / 100,
  }));
}

export interface SalarySummaryReportRow {
  "Total Employees": number;
  "Total Salary": number;
  "Total Worked Hours": number;
  "Total Override Hours": number;
  "Pending Attendance Corrections": number;
}

export function getSalarySummaryReportRow(
  records: SalaryRecord[],
  pendingCorrections: AttendanceRecord[]
): SalarySummaryReportRow {
  let totalSalary = 0;
  let totalWorkedMinutes = 0;
  let totalOverrideMinutes = 0;

  for (const record of records) {
    totalSalary += record.finalSalaryAmount;
    totalWorkedMinutes += record.workedMinutes;
    if (record.overridePayableMinutes !== undefined) {
      totalOverrideMinutes += record.overridePayableMinutes;
    }
  }

  return {
    "Total Employees": records.length,
    "Total Salary": Math.round(totalSalary * 100) / 100,
    "Total Worked Hours": minutesToDecimalHours(totalWorkedMinutes),
    "Total Override Hours": minutesToDecimalHours(totalOverrideMinutes),
    "Pending Attendance Corrections": pendingCorrections.length,
  };
}

export interface AttendanceExceptionReportRow {
  Category: "Missing Checkout" | "Duplicate Attendance" | "Late Arrival" | "Manual Override";
  "Employee ID": string;
  "Employee Name": string;
  Date: string;
  Detail: string;
}

export function getAttendanceExceptionReportRows(
  attendance: AttendanceRecord[],
  records: SalaryRecord[],
  employees: Employee[]
): AttendanceExceptionReportRow[] {
  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const rows: AttendanceExceptionReportRow[] = [];

  for (const record of attendance) {
    if (record.isPendingCorrection) {
      rows.push({
        Category: "Missing Checkout",
        "Employee ID": record.employeeCode,
        "Employee Name": record.employeeName,
        Date: record.attendanceDate,
        Detail: "Checkout not recorded",
      });
    }
  }

  // Structurally impossible given attendance's unique(employee_id, attendance_date)
  // constraint -- still computed and rendered (as "0 found" when empty) per the report spec.
  const seen = new Set<string>();
  for (const record of attendance) {
    const key = `${record.employeeId}|${record.attendanceDate}`;
    if (seen.has(key)) {
      rows.push({
        Category: "Duplicate Attendance",
        "Employee ID": record.employeeCode,
        "Employee Name": record.employeeName,
        Date: record.attendanceDate,
        Detail: "Duplicate row detected",
      });
    }
    seen.add(key);
  }

  for (const record of attendance) {
    if (record.salaryVerificationStatus !== "Frozen") continue;
    const employee = employeesById.get(record.employeeId);
    if (!employee || !isLateArrival(record.checkInTime, employee.dailyStartTime)) continue;
    rows.push({
      Category: "Late Arrival",
      "Employee ID": record.employeeCode,
      "Employee Name": record.employeeName,
      Date: record.attendanceDate,
      Detail: `Checked in at ${record.checkInTime ?? "—"}`,
    });
  }

  for (const record of records) {
    if (record.overridePayableMinutes === undefined) continue;
    rows.push({
      Category: "Manual Override",
      "Employee ID": record.employeeCode,
      "Employee Name": record.employeeName,
      Date: "—",
      Detail: `${minutesToDecimalHours(record.payableMinutes)}h → ${minutesToDecimalHours(record.overridePayableMinutes)}h (${record.overrideReasonCategory ?? ""})`,
    });
  }

  return rows;
}
