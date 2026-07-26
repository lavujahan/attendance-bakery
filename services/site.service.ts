import { supabaseBrowser } from "@/lib/supabase/client";
import { SiteFormData } from "@/schemas/site.schema";
import { Site } from "@/types/site";

const TABLE = "sites";

type SiteRow = {
  id: string;
  site_code: string;
  site_name: string;
  client_name: string;
  site_incharge: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  geofence_enabled: boolean;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};

function mapRow(row: SiteRow): Site {
  return {
    id: row.id,
    siteCode: row.site_code,
    siteName: row.site_name,
    clientName: row.client_name,
    siteIncharge: row.site_incharge,
    latitude: row.latitude,
    longitude: row.longitude,
    allowedRadius: row.allowed_radius,
    geofenceEnabled: row.geofence_enabled,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function addSite(data: SiteFormData) {
  const { error } = await supabaseBrowser.from(TABLE).insert({
    site_name: data.siteName,
    client_name: data.clientName,
    site_incharge: data.siteIncharge,
    latitude: data.latitude,
    longitude: data.longitude,
    allowed_radius: data.allowedRadius,
    geofence_enabled: data.geofenceEnabled,
    status: data.status,
  });

  if (error) throw error;
}

export async function updateSite(id: string, data: SiteFormData) {
  const { error } = await supabaseBrowser
    .from(TABLE)
    .update({
      site_name: data.siteName,
      client_name: data.clientName,
      site_incharge: data.siteIncharge,
      latitude: data.latitude,
      longitude: data.longitude,
      allowed_radius: data.allowedRadius,
      status: data.status,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteSite(id: string) {
  const { error } = await supabaseBrowser.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function getSites() {
  const { data, error } = await supabaseBrowser.from(TABLE).select("*").order("site_code", { ascending: true });
  if (error) throw error;

  return (data as SiteRow[]).map(mapRow);
}

export function subscribeSites(callback: (sites: Site[]) => void) {
  let cancelled = false;

  const refetch = async () => {
    const sites = await getSites();
    if (!cancelled) callback(sites);
  };

  void refetch();

  const channel = supabaseBrowser
    .channel("sites-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refetch())
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}
