export type AttendanceStatus = "Checked In" | "Completed" | "Absent";
export type FaceStatus = "verified" | "unverified" | "service_error";
export type SalaryVerificationStatus = "Draft" | "Verified" | "Frozen";

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  attendanceDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInAccuracy?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutAccuracy?: number;
  checkInFaceStatus?: FaceStatus;
  checkInFaceConfidence?: number;
  checkOutFaceStatus?: FaceStatus;
  checkOutFaceConfidence?: number;
  status: AttendanceStatus;
  remarks?: string;
  salaryVerificationStatus: SalaryVerificationStatus;
  isPendingCorrection: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  frozenAt?: string;
  frozenBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
