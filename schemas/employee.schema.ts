import { z } from "zod";

export const employeeSchema = z
  .object({
    employeeName: z.string().min(3, "Employee name is required"),

    mobileNumber: z
      .string()
      .regex(/^[0-9]{10}$/, "Enter a valid mobile number"),

    gender: z.enum(["Male", "Female", "Other"]),

    designation: z.string().min(2, "Designation is required"),

    joiningDate: z.string(),

    dailyStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time (HH:MM)"),

    dailyEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time (HH:MM)"),

    status: z.enum(["Active", "Inactive"]),

    salaryPerDay: z.number().min(0, "Salary per day must be 0 or more"),

    // Never typed by the admin -- set programmatically in EmployeeForm's submit handler
    // after a successful Google Drive upload (see app/dashboard/employees/idProofActions.ts).
    idProofUrl: z.string().optional(),

    siteId: z.string().min(1, "Godown is required"),
  })
  .refine((data) => data.dailyEndTime > data.dailyStartTime, {
    message: "End time must be after start time",
    path: ["dailyEndTime"],
  });

export type EmployeeFormData = z.infer<typeof employeeSchema>;
