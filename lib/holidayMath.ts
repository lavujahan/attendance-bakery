// Pure calendar helpers for holiday computation -- no Supabase dependency, safe to
// import from both the holiday service and any component that needs to render a
// calendar without waiting on a fetch.

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Parsed as a local midnight, not UTC, so day-of-week is never off by one for
// timezones behind UTC.
export function isSunday(isoDate: string): boolean {
  return new Date(`${isoDate}T00:00:00`).getDay() === 0;
}

export function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const paddedMonth = String(month).padStart(2, "0");
  const startDate = `${year}-${paddedMonth}-01`;
  const endDate = `${year}-${paddedMonth}-${String(getDaysInMonth(year, month)).padStart(2, "0")}`;
  return { startDate, endDate };
}

export function getSundaysInRange(startDate: string, endDate: string): string[] {
  const sundays: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);

  while (cursor <= last) {
    if (cursor.getDay() === 0) sundays.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return sundays;
}

export function getSundaysInMonth(year: number, month: number): string[] {
  const { startDate, endDate } = getMonthRange(year, month);
  return getSundaysInRange(startDate, endDate);
}
