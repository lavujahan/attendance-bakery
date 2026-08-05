export type HolidayType = "CUSTOM" | "SUNDAY_REMOVED";

// Raw DB row -- only exceptions to "every Sunday is a holiday" are ever persisted.
export interface HolidayOverride {
  id?: string;
  siteId: string;
  holidayDate: string; // "YYYY-MM-DD"
  type: HolidayType;
  name?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Computed, unified entry for a given month -- one per calendar date that IS
// currently a holiday, merging default Sundays with CUSTOM overrides.
export interface HolidayEntry {
  date: string; // "YYYY-MM-DD"
  name: string;
  isDefaultSunday: boolean;
  source: "SUNDAY" | "CUSTOM";
  dbId?: string; // id of the CUSTOM row, when source === "CUSTOM" -- needed for edit/delete
}
