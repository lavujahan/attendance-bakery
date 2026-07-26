import { z } from "zod";

export const employeeSiteMappingSchema = z
  .object({
    siteId: z.string().min(1, "Site is required"),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    employeeIds: z.array(z.string()).min(1, "At least one employee must be selected"),
    status: z.enum(["Active", "Inactive"]).default("Active"),
  })
  .superRefine((data, ctx) => {
    if (data.fromDate && data.toDate && data.toDate < data.fromDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "To date must be greater than or equal to from date",
        path: ["toDate"],
      });
    }
  });

export type EmployeeSiteMappingFormValues = z.infer<typeof employeeSiteMappingSchema>;
