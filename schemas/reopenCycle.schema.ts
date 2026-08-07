import { z } from "zod";

export const reopenCycleSchema = z.object({
  reason: z.string().min(3, "A reason is required to reopen"),
});

export type ReopenCycleFormData = z.infer<typeof reopenCycleSchema>;
