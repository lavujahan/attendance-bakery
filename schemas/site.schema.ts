import { z } from "zod";

export const siteSchema = z.object({
  siteName: z.string().min(2, "Godown name is required"),
  siteIncharge: z.string().min(2, "Godown incharge is required"),
  latitude: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  allowedRadius: z.number().min(50, "Allowed radius must be at least 50").max(5000, "Allowed radius must be at most 5000"),
  geofenceEnabled: z.boolean(),
  status: z.enum(["Active", "Inactive"]),
});

export type SiteFormData = z.infer<typeof siteSchema>;
