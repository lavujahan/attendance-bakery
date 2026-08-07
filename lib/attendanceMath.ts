// Pure attendance helpers -- no Supabase dependency, safe to import from both
// browser code (services/*.service.ts) and server-only code (app/attendance/actions.ts).

export type AttendanceEditorStatus = "Present" | "Half Day" | "Absent" | "Working";

export function getTodayDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function normalizeTimeInput(value?: string) {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower.includes("am") || lower.includes("pm")) {
    const [timePart, modifier] = trimmed.split(" ");
    const [rawHours, rawMinutes] = timePart.split(":");
    let hours = Number(rawHours);
    const minutes = Number(rawMinutes || 0);

    if (modifier === "pm" && hours < 12) {
      hours += 12;
    }

    if (modifier === "am" && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const [rawHours, rawMinutes] = trimmed.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes || 0);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value?: string): number | null {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function calculateMinutesBetween(checkInTime?: string, checkOutTime?: string) {
  const start = timeToMinutes(checkInTime);
  const end = timeToMinutes(checkOutTime);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return end - start;
}

export function deriveAttendanceStatus(
  displayStatus?: AttendanceEditorStatus,
  checkInTime?: string,
  checkOutTime?: string
) {
  if (!displayStatus) {
    return checkOutTime ? "Completed" : "Checked In";
  }

  switch (displayStatus) {
    case "Working":
      return "Checked In";
    case "Absent":
      return "Absent";
    case "Present":
    case "Half Day":
    default:
      return checkOutTime ? "Completed" : "Checked In";
  }
}

// Admins enter a daily wage; this derives the internally-stored hourly rate from that
// amount and the employee's own shift length, rounded to the nearest 10 (e.g. a
// computed ₹44.4/hr becomes ₹40/hr). A zero/negative-length shift (end <= start) yields
// 0 rather than dividing by zero -- the form's own validation should make this
// unreachable, but this keeps the calculation safe regardless.
export function calculateSalaryPerHour(salaryPerDay: number, dailyStartTime: string, dailyEndTime: string): number {
  const shiftMinutes = calculateMinutesBetween(dailyStartTime, dailyEndTime);
  if (!shiftMinutes) return 0;
  const hourly = salaryPerDay / (shiftMinutes / 60);
  return Math.round(hourly / 10) * 10;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Late/early both get a 10-minute grace window before they're flagged -- once flagged,
// the reported minutes are still the real gap from the scheduled time, not the gap
// minus the grace period. Exported so lib/payrollMath.ts derives its deduction math from
// the same constant instead of redefining it and risking the two windows drifting apart.
export const GRACE_MINUTES = 10;

// Late is per-employee now (employees.daily_start_time), not a hardcoded 9:00 cutoff.
export function isLateArrival(checkInTime: string | undefined, dailyStartTime: string): boolean {
  const checkInMinutes = timeToMinutes(checkInTime);
  const startMinutes = timeToMinutes(dailyStartTime);
  if (checkInMinutes === null || startMinutes === null) return false;
  return checkInMinutes > startMinutes + GRACE_MINUTES;
}

export function minutesLate(checkInTime: string | undefined, dailyStartTime: string): number | null {
  const checkInMinutes = timeToMinutes(checkInTime);
  const startMinutes = timeToMinutes(dailyStartTime);
  if (checkInMinutes === null || startMinutes === null || checkInMinutes <= startMinutes + GRACE_MINUTES) return null;
  return checkInMinutes - startMinutes;
}

// Early leaver is per-employee now (employees.daily_end_time). Only applies once the
// employee has actually checked out -- still-working employees are never "early".
export function isEarlyLeaver(checkOutTime: string | undefined, dailyEndTime: string): boolean {
  const checkOutMinutes = timeToMinutes(checkOutTime);
  const endMinutes = timeToMinutes(dailyEndTime);
  if (checkOutMinutes === null || endMinutes === null) return false;
  return checkOutMinutes < endMinutes - GRACE_MINUTES;
}

export function minutesEarly(checkOutTime: string | undefined, dailyEndTime: string): number | null {
  const checkOutMinutes = timeToMinutes(checkOutTime);
  const endMinutes = timeToMinutes(dailyEndTime);
  if (checkOutMinutes === null || endMinutes === null || checkOutMinutes >= endMinutes - GRACE_MINUTES) return null;
  return endMinutes - checkOutMinutes;
}
