import { z } from "zod";

export const salaryCycleSchema = z
  .object({
    fromDate: z.string().min(1, "Start date is required"),
    toDate: z.string().min(1, "End date is required"),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    message: "End date must be on or after start date",
    path: ["toDate"],
  });

export type SalaryCycleFormData = z.infer<typeof salaryCycleSchema>;
