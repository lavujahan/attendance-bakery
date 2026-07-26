import { z } from "zod";

export const employeeSchema = z.object({
  employeeName: z.string().min(3, "Employee name is required"),

  mobileNumber: z
    .string()
    .regex(/^[0-9]{10}$/, "Enter a valid mobile number"),

  email: z.string().email("Invalid email").optional().or(z.literal("")),

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
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
