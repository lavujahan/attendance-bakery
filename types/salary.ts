export type SalaryCycleStatus = "Draft" | "Finalized" | "Paid";
export type SalaryRecordStatus = "Draft" | "Finalized" | "Paid";
export type OverrideReasonCategory =
  | "Rain"
  | "Power Failure"
  | "Festival"
  | "Management Decision"
  | "Emergency"
  | "Other";
export type CycleAuditAction = "Finalized" | "Reopened" | "Paid";

export interface SalaryCycle {
  id?: string;
  fromDate: string;
  toDate: string;
  status: SalaryCycleStatus;
  notes?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  paidAt?: string;
  paidBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SalaryRecord {
  id?: string;
  salaryCycleId: string;
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  siteId?: string;
  siteCode: string;
  siteName: string;
  workedMinutes: number;
  deductionMinutes: number;
  payableMinutes: number;
  hourlyRate: number;
  grossSalaryAmount: number;
  overridePayableMinutes?: number;
  overrideReasonCategory?: OverrideReasonCategory;
  overrideNote?: string;
  overrideBy?: string;
  overrideAt?: string;
  finalPayableMinutes: number;
  finalSalaryAmount: number;
  attendanceDaysCount: number;
  missingCheckoutCount: number;
  recordStatus: SalaryRecordStatus;
  paidAt?: string;
  paidBy?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SalaryCycleAuditLogEntry {
  id?: string;
  salaryCycleId: string;
  action: CycleAuditAction;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  performedBy?: string;
  performedAt?: string;
}

export interface FinalizeChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface FinalizeChecklistResult {
  items: FinalizeChecklistItem[];
  allPassed: boolean;
}
