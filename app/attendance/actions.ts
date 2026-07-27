"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyFace } from "@/lib/faceService/client";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { AttendanceRecord, FaceStatus } from "@/types/attendance";
import { getTodayDate, normalizeTimeInput } from "@/lib/attendanceMath";

// Server Actions backing the unauthenticated `/attendance` kiosk flow. These run
// entirely server-side using the service-role client (bypasses RLS, since no anon
// policies are granted on any table -- see supabase/migrations/0001_init.sql) so a
// tampered client can never read/write these tables directly.

function mapEmployeeRow(row: {
  id: string;
  employee_code: string;
  employee_name: string;
  mobile_number: string;
  serial_no: number;
  gender: "Male" | "Female" | "Other";
  designation: string;
  joining_date: string;
  daily_start_time: string;
  daily_end_time: string;
  face_enrolled: boolean;
  status: "Active" | "Inactive";
  salary_per_hour: number;
  site_id: string | null;
  created_at: string;
  updated_at: string;
}): Employee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    mobileNumber: row.mobile_number,
    serialNo: row.serial_no,
    gender: row.gender,
    designation: row.designation,
    joiningDate: row.joining_date,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    faceEnrolled: row.face_enrolled,
    status: row.status,
    salaryPerHour: row.salary_per_hour,
    siteId: row.site_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSiteRow(row: {
  id: string;
  site_code: string;
  site_name: string;
  site_incharge: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  geofence_enabled: boolean;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
}): Site {
  return {
    id: row.id,
    siteCode: row.site_code,
    siteName: row.site_name,
    siteIncharge: row.site_incharge,
    latitude: row.latitude,
    longitude: row.longitude,
    allowedRadius: row.allowed_radius,
    geofenceEnabled: row.geofence_enabled,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttendanceRow(row: {
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
  created_at: string;
  updated_at: string;
}): AttendanceRecord {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findEmployeeBySerialNo(serialNo: number): Promise<Employee | null> {
  const { data, error } = await supabaseAdmin.from("employees").select("*").eq("serial_no", serialNo).maybeSingle();
  if (error) throw error;

  return data ? mapEmployeeRow(data as Parameters<typeof mapEmployeeRow>[0]) : null;
}

export async function getEmployeeAssignedSite(siteId: string): Promise<Site | null> {
  const { data, error } = await supabaseAdmin.from("sites").select("*").eq("id", siteId).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapSiteRow(data as Parameters<typeof mapSiteRow>[0]);
}

export async function getTodayAttendance(employeeId: string): Promise<AttendanceRecord[]> {
  const today = getTodayDate();

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", today)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapAttendanceRow);
}

// ---- Kiosk gate check ---------------------------------------------------
// Fail-fast, cheapest checks first, all before the client ever requests GPS or
// camera permission: Active status -> face enrolled -> active site assignment.
// The old app (attendance_updated-main) only checked site assignment up front and
// discovered "not enrolled" from face-service's response after a wasted capture --
// this front-loads every gate that's just a DB read.
export type KioskGateResult =
  | { outcome: "ok"; employee: Employee; site: Site; action: "check_in" | "check_out"; existingRecordId?: string }
  | { outcome: "invalid_id" }
  | { outcome: "inactive" }
  | { outcome: "not_enrolled" }
  | { outcome: "no_site_assignment" }
  | { outcome: "already_completed"; employee: Employee; site: Site; record: AttendanceRecord };

export async function checkKioskGates(serialNoInput: string): Promise<KioskGateResult> {
  const serialNo = Number(serialNoInput);
  const employee = Number.isFinite(serialNo) ? await findEmployeeBySerialNo(serialNo) : null;

  if (!employee) {
    return { outcome: "invalid_id" };
  }

  if (employee.status !== "Active") {
    return { outcome: "inactive" };
  }

  if (!employee.faceEnrolled) {
    return { outcome: "not_enrolled" };
  }

  if (!employee.siteId) {
    return { outcome: "no_site_assignment" };
  }

  const site = await getEmployeeAssignedSite(employee.siteId);
  if (!site) {
    return { outcome: "no_site_assignment" };
  }

  const records = await getTodayAttendance(employee.id ?? "");
  const existingRecord = records[0] ?? null;

  if (existingRecord?.checkInTime && existingRecord?.checkOutTime) {
    return { outcome: "already_completed", employee, site, record: existingRecord };
  }

  const action = existingRecord?.checkInTime && !existingRecord?.checkOutTime ? "check_out" : "check_in";
  return { outcome: "ok", employee, site, action, existingRecordId: existingRecord?.id };
}

// ---- Recording check-in / check-out -------------------------------------

export async function checkIn(data: {
  employee: Employee;
  site: Site;
  latitude: number;
  longitude: number;
  accuracy: number;
  faceStatus: FaceStatus;
  faceConfidence: number | null;
}) {
  const today = getTodayDate();

  const { error } = await supabaseAdmin.from("attendance").upsert(
    {
      employee_id: data.employee.id,
      employee_code: data.employee.employeeCode,
      employee_name: data.employee.employeeName,
      designation: data.employee.designation,
      site_id: data.site.id,
      site_code: data.site.siteCode,
      site_name: data.site.siteName,
      attendance_date: today,
      check_in_time: normalizeTimeInput(
        new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })
      ),
      check_in_latitude: data.latitude,
      check_in_longitude: data.longitude,
      check_in_accuracy: data.accuracy,
      check_in_face_status: data.faceStatus,
      check_in_face_confidence: data.faceConfidence,
      status: "Checked In",
    },
    { onConflict: "employee_id,attendance_date" }
  );

  if (error) throw error;
}

export async function checkOut(data: {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordId: string;
  faceStatus: FaceStatus;
  faceConfidence: number | null;
}) {
  const { error } = await supabaseAdmin
    .from("attendance")
    .update({
      check_out_time: normalizeTimeInput(
        new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" })
      ),
      check_out_latitude: data.latitude,
      check_out_longitude: data.longitude,
      check_out_accuracy: data.accuracy,
      check_out_face_status: data.faceStatus,
      check_out_face_confidence: data.faceConfidence,
      status: "Completed",
    })
    .eq("id", data.recordId);

  if (error) throw error;
}

// ---- Face verification + recording, in one call from the capture step ----
// - "retry": the capture itself was unusable (no face / multiple faces / bad image) --
//   no attendance row written, employee just recaptures.
// - "restart": employee's enrollment state changed since the gate check (rare race) --
//   no attendance row written, kiosk should restart from ID entry.
// - "recorded": an attendance row was written with the given faceStatus. 'verified' and
//   'unverified' both come from a genuine face-service response; 'service_error' means
//   face-service was unreachable/timed out -- all three are fail-open (never block a
//   legitimate employee over a mismatch or a technical hiccup), but distinguishable for
//   HR triage (see lib/faceService/client.ts for the full rationale).
export type FaceAttendanceResult =
  | { outcome: "retry"; message: string }
  | { outcome: "restart"; message: string }
  | { outcome: "recorded"; faceStatus: FaceStatus; confidence: number | null; checkInTime: string | null; checkOutTime: string | null };

export async function verifyFaceAndRecordAttendance(params: {
  employee: Employee;
  site: Site;
  action: "check_in" | "check_out";
  latitude: number;
  longitude: number;
  accuracy: number;
  recordId?: string;
  image: Blob;
}): Promise<FaceAttendanceResult> {
  const result = await verifyFace(params.employee.id ?? "", params.action, params.image);

  if (result.outcome === "retry") {
    const messages: Record<typeof result.reason, string> = {
      no_face: "No face detected — center your face in the frame and try again.",
      multiple_faces: "More than one face detected — make sure only you are in frame.",
      invalid_image: "Could not read that photo — try again.",
    };
    return { outcome: "retry", message: messages[result.reason] };
  }

  if (result.outcome === "not_enrolled") {
    return { outcome: "restart", message: "Face enrollment is no longer active for this employee — contact HR." };
  }

  const faceStatus: FaceStatus =
    result.outcome === "verified" ? "verified" : result.outcome === "unverified" ? "unverified" : "service_error";
  const confidence = result.outcome === "verified" || result.outcome === "unverified" ? result.confidence : null;

  if (params.action === "check_in") {
    await checkIn({
      employee: params.employee,
      site: params.site,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy,
      faceStatus,
      faceConfidence: confidence,
    });
  } else {
    await checkOut({
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy,
      recordId: params.recordId ?? "",
      faceStatus,
      faceConfidence: confidence,
    });
  }

  const records = await getTodayAttendance(params.employee.id ?? "");
  const record = records[0] ?? null;

  return {
    outcome: "recorded",
    faceStatus,
    confidence,
    checkInTime: record?.checkInTime ?? null,
    checkOutTime: record?.checkOutTime ?? null,
  };
}
