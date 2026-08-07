import { supabaseBrowser } from "@/lib/supabase/client";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type {
  FinalizeChecklistItem,
  FinalizeChecklistResult,
  SalaryCycle,
  SalaryCycleAuditLogEntry,
  SalaryRecord,
} from "@/types/salary";

const TABLE = "salary_cycles";
const AUDIT_TABLE = "salary_cycle_audit_log";
const EXCLUSION_VIOLATION = "23P01";

type SalaryCycleRow = {
  id: string;
  from_date: string;
  to_date: string;
  status: SalaryCycle["status"];
  notes: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
};

type AuditLogRow = {
  id: string;
  salary_cycle_id: string;
  action: SalaryCycleAuditLogEntry["action"];
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  performed_by: string | null;
  performed_at: string;
};

function mapCycleRow(row: SalaryCycleRow): SalaryCycle {
  return {
    id: row.id,
    fromDate: row.from_date,
    toDate: row.to_date,
    status: row.status,
    notes: row.notes ?? undefined,
    finalizedAt: row.finalized_at ?? undefined,
    finalizedBy: row.finalized_by ?? undefined,
    paidAt: row.paid_at ?? undefined,
    paidBy: row.paid_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditRow(row: AuditLogRow): SalaryCycleAuditLogEntry {
  return {
    id: row.id,
    salaryCycleId: row.salary_cycle_id,
    action: row.action,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status ?? undefined,
    reason: row.reason ?? undefined,
    performedBy: row.performed_by ?? undefined,
    performedAt: row.performed_at,
  };
}

export async function getAllSalaryCycles(): Promise<SalaryCycle[]> {
  const { data, error } = await supabaseBrowser.from(TABLE).select("*").order("from_date", { ascending: false });
  if (error) throw error;
  return (data as SalaryCycleRow[]).map(mapCycleRow);
}

export function subscribeSalaryCycles(callback: (cycles: SalaryCycle[]) => void) {
  let cancelled = false;

  const refetch = async () => {
    const cycles = await getAllSalaryCycles();
    if (!cancelled) callback(cycles);
  };

  void refetch();

  const channel = supabaseBrowser
    .channel(`salary-cycles-changes-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refetch())
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Contiguous, same length as the most recently Finalized/Paid cycle. Returns null when
// there's no prior cycle to anchor to -- the admin picks the first cycle's dates manually.
export async function suggestNextSalaryCycle(): Promise<{ fromDate: string; toDate: string } | null> {
  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .in("status", ["Finalized", "Paid"])
    .order("to_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const previous = mapCycleRow(data as SalaryCycleRow);
  const lengthDays = daysBetween(previous.fromDate, previous.toDate) + 1;
  const nextFrom = addDays(previous.toDate, 1);
  const nextTo = addDays(nextFrom, lengthDays - 1);

  return { fromDate: nextFrom, toDate: nextTo };
}

export async function createSalaryCycle(data: { fromDate: string; toDate: string; notes?: string }): Promise<SalaryCycle> {
  const { data: inserted, error } = await supabaseBrowser
    .from(TABLE)
    .insert({ from_date: data.fromDate, to_date: data.toDate, notes: data.notes ?? null })
    .select("*")
    .single();

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      throw new Error("This period overlaps an existing salary cycle.");
    }
    throw error;
  }

  return mapCycleRow(inserted as SalaryCycleRow);
}

export async function updateSalaryCycleDates(id: string, data: { fromDate: string; toDate: string }): Promise<void> {
  const { data: updated, error } = await supabaseBrowser
    .from(TABLE)
    .update({ from_date: data.fromDate, to_date: data.toDate })
    .eq("id", id)
    .eq("status", "Draft")
    .select("id");

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      throw new Error("This period overlaps an existing salary cycle.");
    }
    throw error;
  }
  if (!updated || updated.length === 0) {
    throw new Error("Only a Draft salary cycle can have its dates changed.");
  }
}

export async function deleteSalaryCycle(id: string): Promise<void> {
  const { data: deleted, error } = await supabaseBrowser.from(TABLE).delete().eq("id", id).eq("status", "Draft").select("id");
  if (error) throw error;
  if (!deleted || deleted.length === 0) {
    throw new Error("Only a Draft salary cycle can be deleted.");
  }
}

// Client-side, informational re-derivation of the same 5 checks the finalize_salary_cycle
// RPC enforces server-side -- purely to render a live checklist before the admin attempts
// to finalize. The RPC (not this) is the authoritative gate; a race or stale fetch here
// can never let a bad finalize through, because the RPC re-checks everything itself.
export function getFinalizeChecklist(
  cycle: SalaryCycle,
  attendanceInRange: AttendanceRecord[],
  salaryRecords: SalaryRecord[],
  employees: Employee[]
): FinalizeChecklistResult {
  const unfrozenCount = attendanceInRange.filter((a) => a.salaryVerificationStatus !== "Frozen").length;
  const pendingCount = attendanceInRange.filter((a) => a.isPendingCorrection).length;

  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const frozen = attendanceInRange.filter((a) => a.salaryVerificationStatus === "Frozen");
  const employeeIdsWithFrozenAttendance = new Set(frozen.map((a) => a.employeeId));
  const missingRateCount = Array.from(employeeIdsWithFrozenAttendance).filter((id) => {
    const employee = employeesById.get(id);
    return !employee || !(employee.salaryPerHour > 0);
  }).length;

  const dupKeySeen = new Set<string>();
  let duplicateCount = 0;
  for (const record of attendanceInRange) {
    const key = `${record.employeeId}|${record.attendanceDate}`;
    if (dupKeySeen.has(key)) duplicateCount += 1;
    dupKeySeen.add(key);
  }

  const recordedEmployeeIds = new Set(salaryRecords.map((r) => r.employeeId));
  const previewMissingCount = Array.from(employeeIdsWithFrozenAttendance).filter((id) => !recordedEmployeeIds.has(id)).length;

  const items: FinalizeChecklistItem[] = [
    {
      key: "attendance_frozen",
      label: "Attendance frozen for the full cycle window",
      passed: unfrozenCount === 0,
      detail: unfrozenCount > 0 ? `${unfrozenCount} record(s) not frozen yet` : undefined,
    },
    {
      key: "no_missing_checkout",
      label: "No missing checkouts",
      passed: pendingCount === 0,
      detail: pendingCount > 0 ? `${pendingCount} record(s) pending correction` : undefined,
    },
    {
      key: "hourly_rate_exists",
      label: "Hourly rate configured for every employee with attendance",
      passed: missingRateCount === 0,
      detail: missingRateCount > 0 ? `${missingRateCount} employee(s) missing an hourly rate` : undefined,
    },
    {
      key: "no_duplicate_attendance",
      label: "No duplicate attendance records",
      passed: duplicateCount === 0,
      detail: duplicateCount > 0 ? `${duplicateCount} duplicate row(s) detected` : undefined,
    },
    {
      key: "not_already_finalized",
      label: "Salary cycle not already finalized",
      passed: cycle.status === "Draft",
      detail: cycle.status !== "Draft" ? `Cycle is already ${cycle.status}` : undefined,
    },
    {
      key: "preview_up_to_date",
      label: "Salary preview is up to date",
      passed: previewMissingCount === 0,
      detail: previewMissingCount > 0 ? "Recompute the salary grid before finalizing" : undefined,
    },
  ];

  return { items, allPassed: items.every((item) => item.passed) };
}

export async function finalizeSalaryCycle(cycleId: string, adminId: string): Promise<void> {
  const { error } = await supabaseBrowser.rpc("finalize_salary_cycle", {
    p_cycle_id: cycleId,
    p_admin_id: adminId,
  });
  if (error) throw new Error(error.message);
}

export async function reopenSalaryCycle(cycleId: string, adminId: string, reason: string): Promise<void> {
  const { error } = await supabaseBrowser.rpc("reopen_salary_cycle", {
    p_cycle_id: cycleId,
    p_admin_id: adminId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function markSalaryCyclePaid(cycleId: string, adminId: string): Promise<void> {
  const { error } = await supabaseBrowser.rpc("mark_salary_cycle_paid", {
    p_cycle_id: cycleId,
    p_admin_id: adminId,
  });
  if (error) throw new Error(error.message);
}

export async function getCycleAuditLog(cycleId: string): Promise<SalaryCycleAuditLogEntry[]> {
  const { data, error } = await supabaseBrowser
    .from(AUDIT_TABLE)
    .select("*")
    .eq("salary_cycle_id", cycleId)
    .order("performed_at", { ascending: false });

  if (error) throw error;
  return (data as AuditLogRow[]).map(mapAuditRow);
}
