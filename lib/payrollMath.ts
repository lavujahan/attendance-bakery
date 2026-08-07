// Payroll math -- pure, no Supabase dependency (mirrors lib/attendanceMath.ts). Builds
// directly on attendanceMath's grace-period helpers rather than redefining them, so late/
// early detection and salary deduction always agree on what counts as "late".

import { GRACE_MINUTES, calculateMinutesBetween, minutesEarly, minutesLate } from "@/lib/attendanceMath";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";

// minutesLate()/minutesEarly() return null within the 10-minute grace window, and
// otherwise the FULL gap from the scheduled time (not net of grace). The deductible
// excess is therefore (fullGap - GRACE_MINUTES), rounded UP to the next hour -- e.g. 20
// min late (10 min beyond grace) becomes a 60-minute deduction, matching the spec's
// "09:20 -> deduct 20 minutes but as 1 hr" example.
function roundExcessUpToHour(fullGapMinutes: number | null): number {
  if (fullGapMinutes === null) return 0;
  const excess = fullGapMinutes - GRACE_MINUTES;
  if (excess <= 0) return 0;
  return Math.ceil(excess / 60) * 60;
}

export function calculateLateDeductionMinutes(checkInTime: string | undefined, dailyStartTime: string): number {
  return roundExcessUpToHour(minutesLate(checkInTime, dailyStartTime));
}

export function calculateEarlyDeductionMinutes(checkOutTime: string | undefined, dailyEndTime: string): number {
  return roundExcessUpToHour(minutesEarly(checkOutTime, dailyEndTime));
}

export function calculateRecordDeductionMinutes(record: AttendanceRecord, employee: Employee): number {
  return (
    calculateLateDeductionMinutes(record.checkInTime, employee.dailyStartTime) +
    calculateEarlyDeductionMinutes(record.checkOutTime, employee.dailyEndTime)
  );
}

export function calculateRecordWorkedMinutes(record: AttendanceRecord): number {
  return calculateMinutesBetween(record.checkInTime, record.checkOutTime) ?? 0;
}

export interface CycleTotalsForEmployee {
  workedMinutes: number;
  deductionMinutes: number;
  payableMinutes: number;
  attendanceDaysCount: number;
  missingCheckoutCount: number;
}

// Per day: workedMinutes_i, deductionMinutes_i, payableMinutes_i = max(0, worked_i -
// deduction_i). Each series is summed independently across days (not "total worked minus
// total deduction"), so one abnormally short/late day is clamped at 0 in isolation and
// never borrows payable minutes from a different day's surplus.
export function computeEmployeeCycleTotals(
  frozenRecords: AttendanceRecord[],
  employee: Employee
): CycleTotalsForEmployee {
  let workedMinutes = 0;
  let deductionMinutes = 0;
  let payableMinutes = 0;
  let missingCheckoutCount = 0;

  for (const record of frozenRecords) {
    if (record.isPendingCorrection) {
      missingCheckoutCount += 1;
      continue;
    }

    const dayWorked = calculateRecordWorkedMinutes(record);
    const dayDeduction = calculateRecordDeductionMinutes(record, employee);
    const dayPayable = Math.max(0, dayWorked - dayDeduction);

    workedMinutes += dayWorked;
    deductionMinutes += dayDeduction;
    payableMinutes += dayPayable;
  }

  return {
    workedMinutes,
    deductionMinutes,
    payableMinutes,
    attendanceDaysCount: frozenRecords.length,
    missingCheckoutCount,
  };
}

function round2dp(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateGrossSalaryAmount(payableMinutes: number, hourlyRate: number): number {
  return round2dp((payableMinutes / 60) * hourlyRate);
}

export function calculateFinalSalaryAmount(finalPayableMinutes: number, hourlyRate: number): number {
  return round2dp((finalPayableMinutes / 60) * hourlyRate);
}

export function minutesToHoursLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hours}h ${mins}m`;
}

export function minutesToDecimalHours(minutes: number): number {
  return round2dp(minutes / 60);
}
