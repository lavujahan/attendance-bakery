import { z } from "zod";

export const salaryOverrideSchema = z.object({
  overridePayableHours: z.number().min(0, "Payable hours must be 0 or more"),
  overrideReasonCategory: z.enum([
    "Rain",
    "Power Failure",
    "Festival",
    "Management Decision",
    "Emergency",
    "Other",
  ]),
  overrideNote: z.string().min(3, "A brief note is required for the audit trail"),
});

export type SalaryOverrideFormData = z.infer<typeof salaryOverrideSchema>;
