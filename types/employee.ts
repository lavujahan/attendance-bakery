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
  salaryPerHour: number;
  siteId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
