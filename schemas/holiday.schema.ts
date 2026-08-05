import { z } from "zod";

export const holidaySchema = z
  .object({
    siteId: z.string().optional(),
    holidayDate: z.string().min(1, "Date is required"),
    name: z.string().min(2, "Holiday name is required"),
    applyToAllGodowns: z.boolean(),
  })
  .refine((data) => data.applyToAllGodowns || Boolean(data.siteId), {
    message: "Godown is required",
    path: ["siteId"],
  });

export type HolidayFormData = z.infer<typeof holidaySchema>;
