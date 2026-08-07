// Kept separate from services/attendance.service.ts so that file stays plain CRUD --
// this one owns the salary-cycle verify/freeze bulk workflow instead.
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AttendanceRecord, FaceStatus } from "@/types/attendance";

const TABLE = "attendance";

type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string;
  site_id: string;
  site_code: string;
  site_name: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy: number | null;
  check_in_face_status: FaceStatus | null;
  check_in_face_confidence: number | null;
  check_out_face_status: FaceStatus | null;
  check_out_face_confidence: number | null;
  status: AttendanceRecord["status"];
  remarks: string | null;
  salary_verification_status: AttendanceRecord["salaryVerificationStatus"];
  is_pending_correction: boolean;
  verified_at: string | null;
  verified_by: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    designation: row.designation,
    siteId: row.site_id,
    siteCode: row.site_code,
    siteName: row.site_name,
    attendanceDate: row.attendance_date,
    checkInTime: row.check_in_time ?? undefined,
    checkOutTime: row.check_out_time ?? undefined,
    checkInLatitude: row.check_in_latitude ?? undefined,
    checkInLongitude: row.check_in_longitude ?? undefined,
    checkInAccuracy: row.check_in_accuracy ?? undefined,
    checkOutLatitude: row.check_out_latitude ?? undefined,
    checkOutLongitude: row.check_out_longitude ?? undefined,
    checkOutAccuracy: row.check_out_accuracy ?? undefined,
    checkInFaceStatus: row.check_in_face_status ?? undefined,
    checkInFaceConfidence: row.check_in_face_confidence ?? undefined,
    checkOutFaceStatus: row.check_out_face_status ?? undefined,
    checkOutFaceConfidence: row.check_out_face_confidence ?? undefined,
    status: row.status,
    remarks: row.remarks ?? undefined,
    salaryVerificationStatus: row.salary_verification_status,
    isPendingCorrection: row.is_pending_correction,
    verifiedAt: row.verified_at ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    frozenAt: row.frozen_at ?? undefined,
    frozenBy: row.frozen_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAttendanceForCycleWindow(fromDate: string, toDate: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .gte("attendance_date", fromDate)
    .lte("attendance_date", toDate)
    .order("attendance_date", { ascending: true });

  if (error) throw error;
  return (data as AttendanceRow[]).map(mapRow);
}

export async function getPendingCorrections(fromDate: string, toDate: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .gte("attendance_date", fromDate)
    .lte("attendance_date", toDate)
    .eq("is_pending_correction", true)
    .order("attendance_date", { ascending: true });

  if (error) throw error;
  return (data as AttendanceRow[]).map(mapRow);
}

// Draft -> Verified, skipping anything currently pending a missing-checkout correction.
export async function verifyAttendanceRange(
  fromDate: string,
  toDate: string,
  adminId: string
): Promise<{ verified: number; skippedPending: number }> {
  const { data: pending, error: pendingError } = await supabaseBrowser
    .from(TABLE)
    .select("id")
    .gte("attendance_date", fromDate)
    .lte("attendance_date", toDate)
    .eq("salary_verification_status", "Draft")
    .eq("is_pending_correction", true);
  if (pendingError) throw pendingError;

  const { data: verified, error: verifyError } = await supabaseBrowser
    .from(TABLE)
    .update({ salary_verification_status: "Verified", verified_at: new Date().toISOString(), verified_by: adminId })
    .gte("attendance_date", fromDate)
    .lte("attendance_date", toDate)
    .eq("salary_verification_status", "Draft")
    .eq("is_pending_correction", false)
    .select("id");
  if (verifyError) throw verifyError;

  return { verified: verified?.length ?? 0, skippedPending: pending?.length ?? 0 };
}

// Verified -> Frozen. Only rows already Verified are eligible -- freezing skips anything
// still Draft or Pending Correction rather than silently sweeping it in.
export async function freezeAttendanceRange(fromDate: string, toDate: string, adminId: string): Promise<{ frozen: number }> {
  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .update({ salary_verification_status: "Frozen", frozen_at: new Date().toISOString(), frozen_by: adminId })
    .gte("attendance_date", fromDate)
    .lte("attendance_date", toDate)
    .eq("salary_verification_status", "Verified")
    .select("id");

  if (error) throw error;
  return { frozen: data?.length ?? 0 };
}

// Manual undo before freeze -- lets an admin back a single row out of Verified without
// touching its check-in/out data (which would already auto-demote it via the DB trigger).
export async function unverifyAttendanceRecord(id: string): Promise<void> {
  const { error } = await supabaseBrowser
    .from(TABLE)
    .update({ salary_verification_status: "Draft", verified_at: null, verified_by: null })
    .eq("id", id)
    .eq("salary_verification_status", "Verified");

  if (error) throw error;
}
