export interface Site {
  id?: string;
  siteCode: string;
  siteName: string;
  siteIncharge: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
  geofenceEnabled: boolean;
  status: "Active" | "Inactive";
  createdAt?: unknown;
  updatedAt?: unknown;
}
