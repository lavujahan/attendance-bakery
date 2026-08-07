import { supabaseBrowser } from "@/lib/supabase/client";
import type { AttendanceRecord, FaceStatus } from "@/types/attendance";
import {
  type AttendanceEditorStatus,
  calculateMinutesBetween,
  deriveAttendanceStatus,
  normalizeTimeInput,
} from "@/lib/attendanceMath";

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

async function getAllAttendance() {
  const { data, error } = await supabaseBrowser.from(TABLE).select("*");
  if (error) throw error;

  return (data as AttendanceRow[]).map(mapRow).sort((left, right) => {
    const leftDate = left.attendanceDate ?? "";
    const rightDate = right.attendanceDate ?? "";
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }
    return new Date(String(right.createdAt)).getTime() - new Date(String(left.createdAt)).getTime();
  });
}

export function subscribeAttendance(callback: (records: AttendanceRecord[]) => void) {
  let cancelled = false;

  const refetch = async () => {
    const records = await getAllAttendance();
    if (!cancelled) callback(records);
  };

  void refetch();

  // Unique per call -- see the comment in site.service.ts's subscribeSites for why a
  // shared constant channel name breaks once more than one subscriber can be mounted
  // at the same time.
  const channel = supabaseBrowser
    .channel(`attendance-changes-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refetch())
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}

export async function updateAttendance(
  id: string,
  data: {
    checkInTime?: string;
    checkOutTime?: string;
    attendanceStatus?: AttendanceEditorStatus;
    remarks?: string;
  }
) {
  const { data: existing, error: fetchError } = await supabaseBrowser.from(TABLE).select("*").eq("id", id).single();

  if (fetchError || !existing) {
    throw new Error("Attendance record not found.");
  }

  const existingRecord = mapRow(existing as AttendanceRow);
  const normalizedCheckIn = normalizeTimeInput(data.checkInTime ?? existingRecord.checkInTime);
  const normalizedCheckOut = normalizeTimeInput(data.checkOutTime ?? existingRecord.checkOutTime);
  const totalMinutes = calculateMinutesBetween(normalizedCheckIn, normalizedCheckOut);

  let derivedStatus = deriveAttendanceStatus(data.attendanceStatus, normalizedCheckIn, normalizedCheckOut);
  if (!normalizedCheckOut && data.attendanceStatus === "Absent") {
    derivedStatus = "Absent";
  }

  const { error: updateError } = await supabaseBrowser
    .from(TABLE)
    .update({
      check_in_time: normalizedCheckIn || existingRecord.checkInTime || null,
      check_out_time: normalizedCheckOut || existingRecord.checkOutTime || null,
      status: derivedStatus,
      remarks: data.remarks ?? existingRecord.remarks ?? "",
    })
    .eq("id", id);

  if (updateError) throw updateError;

  return { totalMinutes, derivedStatus };
}

export async function deleteAttendance(id: string) {
  const { error } = await supabaseBrowser.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
