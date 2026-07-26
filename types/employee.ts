export interface Employee {
  id?: string;
  employeeCode: string;
  employeeName: string;
  mobileNumber: string;
  phonePrefix: string;
  email: string;
  gender: "Male" | "Female" | "Other";
  designation: string;
  joiningDate: string;
  dailyStartTime: string; // "HH:MM:SS", drives per-employee late calculation
  dailyEndTime: string; // "HH:MM:SS", drives per-employee early-leaver calculation
  faceEnrolled: boolean;
  status: "Active" | "Inactive";
  createdAt?: unknown;
  updatedAt?: unknown;
}
