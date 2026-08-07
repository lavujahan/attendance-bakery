import { supabaseBrowser } from "@/lib/supabase/client";
import {
  calculateFinalSalaryAmount,
  calculateGrossSalaryAmount,
  computeEmployeeCycleTotals,
} from "@/lib/payrollMath";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { OverrideReasonCategory, SalaryCycle, SalaryRecord } from "@/types/salary";

const TABLE = "salary_records";

type SalaryRecordRow = {
  id: string;
  salary_cycle_id: string;
  employee_id: string | null;
  employee_code: string;
  employee_name: string;
  designation: string;
  site_id: string | null;
  site_code: string;
  site_name: string;
  worked_minutes: number;
  deduction_minutes: number;
  payable_minutes: number;
  hourly_rate: number;
  gross_salary_amount: number;
  override_payable_minutes: number | null;
  override_reason_category: OverrideReasonCategory | null;
  override_note: string | null;
  override_by: string | null;
  override_at: string | null;
  final_payable_minutes: number;
  final_salary_amount: number;
  attendance_days_count: number;
  missing_checkout_count: number;
  record_status: SalaryRecord["recordStatus"];
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: SalaryRecordRow): SalaryRecord {
  return {
    id: row.id,
    salaryCycleId: row.salary_cycle_id,
    employeeId: row.employee_id ?? undefined,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    designation: row.designation,
    siteId: row.site_id ?? undefined,
    siteCode: row.site_code,
    siteName: row.site_name,
    workedMinutes: row.worked_minutes,
    deductionMinutes: row.deduction_minutes,
    payableMinutes: row.payable_minutes,
    hourlyRate: row.hourly_rate,
    grossSalaryAmount: row.gross_salary_amount,
    overridePayableMinutes: row.override_payable_minutes ?? undefined,
    overrideReasonCategory: row.override_reason_category ?? undefined,
    overrideNote: row.override_note ?? undefined,
    overrideBy: row.override_by ?? undefined,
    overrideAt: row.override_at ?? undefined,
    finalPayableMinutes: row.final_payable_minutes,
    finalSalaryAmount: row.final_salary_amount,
    attendanceDaysCount: row.attendance_days_count,
    missingCheckoutCount: row.missing_checkout_count,
    recordStatus: row.record_status,
    paidAt: row.paid_at ?? undefined,
    paidBy: row.paid_by ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Lightweight aggregate for the cycle list view -- avoids pulling every salary_records
// row's full shape just to show an employee count and a total on the list page.
export async function getSalaryRecordTotalsByCycle(): Promise<
  Map<string, { employeeCount: number; totalFinalSalary: number }>
> {
  const { data, error } = await supabaseBrowser.from(TABLE).select("salary_cycle_id, final_salary_amount");
  if (error) throw error;

  const totals = new Map<string, { employeeCount: number; totalFinalSalary: number }>();
  for (const row of data as { salary_cycle_id: string; final_salary_amount: number }[]) {
    const bucket = totals.get(row.salary_cycle_id) ?? { employeeCount: 0, totalFinalSalary: 0 };
    bucket.employeeCount += 1;
    bucket.totalFinalSalary += row.final_salary_amount;
    totals.set(row.salary_cycle_id, bucket);
  }
  return totals;
}

export async function getSalaryRecordsForCycle(cycleId: string): Promise<SalaryRecord[]> {
  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .eq("salary_cycle_id", cycleId)
    .order("employee_name", { ascending: true });

  if (error) throw error;
  return (data as SalaryRecordRow[]).map(mapRow);
}

export function subscribeSalaryRecordsForCycle(cycleId: string, callback: (records: SalaryRecord[]) => void) {
  let cancelled = false;

  const refetch = async () => {
    const records = await getSalaryRecordsForCycle(cycleId);
    if (!cancelled) callback(records);
  };

  void refetch();

  const channel = supabaseBrowser
    .channel(`salary-records-changes-${cycleId}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `salary_cycle_id=eq.${cycleId}` },
      () => void refetch()
    )
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}

// Groups frozen attendance by employee, runs the payroll math, and upserts one preview
// row per employee. Only sends computed columns -- override_* is never touched here, so
// an existing override survives a recompute triggered by re-opening the salary grid.
export async function computeAndUpsertPreview(
  cycle: SalaryCycle,
  frozenAttendance: AttendanceRecord[],
  employees: Employee[],
  sites: Site[]
): Promise<SalaryRecord[]> {
  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const sitesById = new Map(sites.map((s) => [s.id, s]));

  const byEmployee = new Map<string, AttendanceRecord[]>();
  for (const record of frozenAttendance) {
    const list = byEmployee.get(record.employeeId) ?? [];
    list.push(record);
    byEmployee.set(record.employeeId, list);
  }

  const rows: Record<string, unknown>[] = [];
  for (const [employeeId, records] of byEmployee.entries()) {
    const employee = employeesById.get(employeeId);
    if (!employee) continue;

    const totals = computeEmployeeCycleTotals(records, employee);
    const grossSalaryAmount = calculateGrossSalaryAmount(totals.payableMinutes, employee.salaryPerHour);
    const site = employee.siteId ? sitesById.get(employee.siteId) : undefined;

    rows.push({
      salary_cycle_id: cycle.id,
      employee_id: employeeId,
      employee_code: employee.employeeCode,
      employee_name: employee.employeeName,
      designation: employee.designation,
      site_id: site?.id ?? null,
      site_code: site?.siteCode ?? "—",
      site_name: site?.siteName ?? "—",
      worked_minutes: totals.workedMinutes,
      deduction_minutes: totals.deductionMinutes,
      payable_minutes: totals.payableMinutes,
      hourly_rate: employee.salaryPerHour,
      gross_salary_amount: grossSalaryAmount,
      final_salary_amount: grossSalaryAmount,
      attendance_days_count: totals.attendanceDaysCount,
      missing_checkout_count: totals.missingCheckoutCount,
    });
  }

  if (rows.length === 0) return [];

  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .upsert(rows, { onConflict: "salary_cycle_id,employee_id" })
    .select("*");

  if (error) throw error;
  return (data as SalaryRecordRow[]).map(mapRow);
}

export async function applyPayableOverride(
  recordId: string,
  data: { overridePayableMinutes: number; overrideReasonCategory: OverrideReasonCategory; overrideNote: string },
  adminId: string
): Promise<void> {
  const { data: existing, error: fetchError } = await supabaseBrowser
    .from(TABLE)
    .select("payable_minutes, hourly_rate")
    .eq("id", recordId)
    .single();
  if (fetchError || !existing) throw new Error("Salary record not found.");

  const hourlyRate = (existing as { hourly_rate: number }).hourly_rate;
  const finalSalaryAmount = calculateFinalSalaryAmount(data.overridePayableMinutes, hourlyRate);

  const { error } = await supabaseBrowser
    .from(TABLE)
    .update({
      override_payable_minutes: data.overridePayableMinutes,
      override_reason_category: data.overrideReasonCategory,
      override_note: data.overrideNote,
      override_by: adminId,
      override_at: new Date().toISOString(),
      final_salary_amount: finalSalaryAmount,
    })
    .eq("id", recordId)
    .eq("record_status", "Draft");

  if (error) throw error;
}

export async function clearPayableOverride(recordId: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabaseBrowser
    .from(TABLE)
    .select("payable_minutes, hourly_rate")
    .eq("id", recordId)
    .single();
  if (fetchError || !existing) throw new Error("Salary record not found.");

  const { payable_minutes: payableMinutes, hourly_rate: hourlyRate } = existing as {
    payable_minutes: number;
    hourly_rate: number;
  };
  const finalSalaryAmount = calculateGrossSalaryAmount(payableMinutes, hourlyRate);

  const { error } = await supabaseBrowser
    .from(TABLE)
    .update({
      override_payable_minutes: null,
      override_reason_category: null,
      override_note: null,
      override_by: null,
      override_at: null,
      final_salary_amount: finalSalaryAmount,
    })
    .eq("id", recordId)
    .eq("record_status", "Draft");

  if (error) throw error;
}

export async function markSalaryRecordPaid(recordId: string, adminId: string): Promise<void> {
  const { data: updated, error } = await supabaseBrowser
    .from(TABLE)
    .update({ record_status: "Paid", paid_at: new Date().toISOString(), paid_by: adminId })
    .eq("id", recordId)
    .eq("record_status", "Finalized")
    .select("id");

  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error("Only a Finalized salary record can be marked Paid.");
  }
}

// Historical lookup -- works even after the employee row is hard-deleted, since these are
// snapshot fields, not a live join. Falls back to matching by employee_code so a lookup
// keyed off a still-known code works post-deletion too.
export async function getSalaryRecordsForEmployee(employeeId: string, employeeCode?: string): Promise<SalaryRecord[]> {
  const query = supabaseBrowser.from(TABLE).select("*");
  const { data, error } = employeeCode
    ? await query.or(`employee_id.eq.${employeeId},employee_code.eq.${employeeCode}`).order("created_at", { ascending: false })
    : await query.eq("employee_id", employeeId).order("created_at", { ascending: false });

  if (error) throw error;
  return (data as SalaryRecordRow[]).map(mapRow);
}
