import { supabaseBrowser } from "@/lib/supabase/client";
import { getMonthRange, getSundaysInMonth, getSundaysInRange, isSunday } from "@/lib/holidayMath";
import { HolidayEntry, HolidayOverride } from "@/types/holiday";

const TABLE = "holidays";
const UNIQUE_VIOLATION = "23505";

type HolidayRow = {
  id: string;
  site_id: string;
  holiday_date: string;
  type: "CUSTOM" | "SUNDAY_REMOVED";
  name: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: HolidayRow): HolidayOverride {
  return {
    id: row.id,
    siteId: row.site_id,
    holidayDate: row.holiday_date,
    type: row.type,
    name: row.name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- CRUD on the exceptions table ---

export async function addHoliday(siteId: string, holidayDate: string, name: string) {
  const { error } = await supabaseBrowser.from(TABLE).insert({
    site_id: siteId,
    holiday_date: holidayDate,
    type: "CUSTOM",
    name,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new Error("A holiday already exists for this date.");
    throw error;
  }
}

export async function addHolidayToAllGodowns(holidayDate: string, name: string) {
  const { data: sites, error: sitesError } = await supabaseBrowser.from("sites").select("id");
  if (sitesError) throw sitesError;
  if (!sites || sites.length === 0) return;

  const rows = sites.map((site: { id: string }) => ({
    site_id: site.id,
    holiday_date: holidayDate,
    type: "CUSTOM" as const,
    name,
  }));

  // ignoreDuplicates so a godown that already has a custom holiday on this date
  // doesn't block the insert for every other godown.
  const { error } = await supabaseBrowser.from(TABLE).upsert(rows, { onConflict: "site_id,holiday_date,type", ignoreDuplicates: true });
  if (error) throw error;
}

export async function updateHoliday(id: string, data: { holidayDate?: string; name?: string }) {
  const payload: Record<string, string> = {};
  if (data.holidayDate) payload.holiday_date = data.holidayDate;
  if (data.name) payload.name = data.name;

  const { error } = await supabaseBrowser.from(TABLE).update(payload).eq("id", id).eq("type", "CUSTOM");

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new Error("A holiday already exists for this date.");
    throw error;
  }
}

export async function deleteHoliday(id: string) {
  const { error } = await supabaseBrowser.from(TABLE).delete().eq("id", id).eq("type", "CUSTOM");
  if (error) throw error;
}

export async function removeSunday(siteId: string, sundayDate: string) {
  if (!isSunday(sundayDate)) throw new Error("Selected date is not a Sunday.");

  const { error } = await supabaseBrowser.from(TABLE).insert({
    site_id: siteId,
    holiday_date: sundayDate,
    type: "SUNDAY_REMOVED",
  });

  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

export async function restoreSunday(siteId: string, sundayDate: string) {
  const { error } = await supabaseBrowser
    .from(TABLE)
    .delete()
    .eq("site_id", siteId)
    .eq("holiday_date", sundayDate)
    .eq("type", "SUNDAY_REMOVED");

  if (error) throw error;
}

// --- Read / compute ---

export async function getHolidayOverrides(siteId: string, year: number, month: number): Promise<HolidayOverride[]> {
  const { startDate, endDate } = getMonthRange(year, month);

  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .eq("site_id", siteId)
    .gte("holiday_date", startDate)
    .lte("holiday_date", endDate)
    .order("holiday_date", { ascending: true });

  if (error) throw error;
  return (data as HolidayRow[]).map(mapRow);
}

// Merges computed Sundays (minus removed ones) with CUSTOM overrides into a single
// sorted list -- a CUSTOM row on a Sunday wins the display name if both exist.
export function deriveHolidayEntries(year: number, month: number, overrides: HolidayOverride[]): HolidayEntry[] {
  const removedSundays = new Set(overrides.filter((o) => o.type === "SUNDAY_REMOVED").map((o) => o.holidayDate));
  const customOverrides = overrides.filter((o) => o.type === "CUSTOM");

  const entries = new Map<string, HolidayEntry>();

  for (const date of getSundaysInMonth(year, month)) {
    if (removedSundays.has(date)) continue;
    entries.set(date, { date, name: "Sunday", isDefaultSunday: true, source: "SUNDAY" });
  }

  for (const override of customOverrides) {
    entries.set(override.holidayDate, {
      date: override.holidayDate,
      name: override.name || "Holiday",
      isDefaultSunday: isSunday(override.holidayDate),
      source: "CUSTOM",
      dbId: override.id,
    });
  }

  return Array.from(entries.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function deriveRemovedSundays(overrides: HolidayOverride[]): HolidayOverride[] {
  return overrides.filter((o) => o.type === "SUNDAY_REMOVED");
}

export async function getHolidaysForMonth(siteId: string, year: number, month: number): Promise<HolidayEntry[]> {
  const overrides = await getHolidayOverrides(siteId, year, month);
  return deriveHolidayEntries(year, month, overrides);
}

export function subscribeHolidayOverrides(
  siteId: string,
  year: number,
  month: number,
  callback: (overrides: HolidayOverride[]) => void
) {
  let cancelled = false;

  const refetch = async () => {
    const overrides = await getHolidayOverrides(siteId, year, month);
    if (!cancelled) callback(overrides);
  };

  void refetch();

  const channel = supabaseBrowser
    .channel(`holidays-changes-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refetch())
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}

// --- Integration helper for dashboard/reports/attendance-management ---
// Holidays are per-godown, so the same date can be a holiday for one site and a
// working day for another -- callers get a Map keyed by siteId rather than a flat Set.
export async function getHolidayDateSetsForRange(
  siteIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (siteIds.length === 0) return result;

  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .in("site_id", siteIds)
    .gte("holiday_date", startDate)
    .lte("holiday_date", endDate);

  if (error) throw error;

  const overrides = (data as HolidayRow[]).map(mapRow);
  const overridesBySite = new Map<string, HolidayOverride[]>();
  for (const override of overrides) {
    const list = overridesBySite.get(override.siteId) ?? [];
    list.push(override);
    overridesBySite.set(override.siteId, list);
  }

  const sundaysInRange = getSundaysInRange(startDate, endDate);

  for (const siteId of siteIds) {
    const siteOverrides = overridesBySite.get(siteId) ?? [];
    const removedSundays = new Set(siteOverrides.filter((o) => o.type === "SUNDAY_REMOVED").map((o) => o.holidayDate));

    const dates = new Set<string>();
    for (const date of sundaysInRange) {
      if (!removedSundays.has(date)) dates.add(date);
    }
    for (const override of siteOverrides) {
      if (override.type === "CUSTOM") dates.add(override.holidayDate);
    }

    result.set(siteId, dates);
  }

  return result;
}
