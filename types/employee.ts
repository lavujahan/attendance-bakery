export interface Employee {
  id?: string;
  employeeCode: string;
  employeeName: string;
  mobileNumber: string;
  serialNo: number;
  gender: "Male" | "Female" | "Other";
  designation: string;
  joiningDate: string;
  dailyStartTime: string; // "HH:MM:SS", drives per-employee late calculation
  dailyEndTime: string; // "HH:MM:SS", drives per-employee early-leaver calculation
  faceEnrolled: boolean;
  status: "Active" | "Inactive";
  salaryPerDay: number;
  salaryPerHour: number; // derived from salaryPerDay + shift length, rounded to the nearest 10
  idProofUrl?: string; // Google Drive shareable link, uploaded via app/dashboard/employees/idProofActions.ts
  siteId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
