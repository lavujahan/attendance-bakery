import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { utils, writeFile } from "xlsx";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import { isLateArrival, minutesLate, isEarlyLeaver, minutesEarly } from "@/lib/attendanceMath";

export type DashboardDatePreset = "today" | "yesterday" | "week" | "month" | "custom";

export interface DashboardFilters {
  datePreset: DashboardDatePreset;
  startDate: string;
  endDate: string;
  siteId: string;
  employeeId: string;
  designation: string;
  status: string;
  search: string;
}

export interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalSites: number;
  activeSites: number;
  employeesAssigned: number;
  present: number;
  absent: number;
  presentToday: number;
  absentToday: number;
  checkedIn: number;
  checkedOut: number;
  lateArrivals: number;
  earlyLeavers: number;
  attendancePercentage: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  early: number;
  checkedIn: number;
  checkedOut: number;
  attendancePercentage: number;
}

export interface SiteAttendanceRow {
  siteId: string;
  siteCode: string;
  siteName: string;
  assignedEmployees: number;
  present: number;
  absent: number;
  late: number;
  early: number;
  attendancePercentage: number;
}

export interface EmployeeAttendanceRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  assignedSite: string;
  checkInTime: string;
  checkOutTime: string;
  workingHours: string;
  attendanceStatus: string;
  gpsStatus: string;
  faceStatus: string;
}

export interface LateArrivalRow {
  employeeName: string;
  siteName: string;
  checkInTime: string;
  delay: string;
}

export interface EarlyLeaverRow {
  employeeName: string;
  siteName: string;
  checkOutTime: string;
  early: string;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
  late: number;
  early: number;
}

export interface ExportReportPayload {
  title: string;
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  headers: string[];
  reportType: string;
  filters: DashboardFilters;
}

function toLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value: string) {
  return value ? value.slice(0, 10) : "";
}

function createDateRange(filters: DashboardFilters) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const preset = filters.datePreset;

  if (preset === "custom") {
    const startDate = normalizeDate(filters.startDate);
    const endDate = normalizeDate(filters.endDate);
    return {
      startDate: startDate || toLocalDateInput(startOfToday),
      endDate: endDate || toLocalDateInput(endOfToday),
    };
  }

  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (preset === "yesterday") {
    return { startDate: toLocalDateInput(yesterday), endDate: toLocalDateInput(yesterday) };
  }
  if (preset === "week") {
    return { startDate: toLocalDateInput(startOfWeek), endDate: toLocalDateInput(startOfToday) };
  }
  if (preset === "month") {
    return { startDate: toLocalDateInput(startOfMonth), endDate: toLocalDateInput(startOfToday) };
  }

  return { startDate: toLocalDateInput(startOfToday), endDate: toLocalDateInput(endOfToday) };
}

function getEffectiveDateRange(filters: DashboardFilters) {
  const { startDate, endDate } = createDateRange(filters);
  return { startDate: normalizeDate(startDate), endDate: normalizeDate(endDate) };
}

function isDateInRange(value: string, startDate: string, endDate: string) {
  if (!value) return false;
  return value >= startDate && value <= endDate;
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const text = value.trim();

  if (text.includes("AM") || text.includes("PM")) {
    const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3].toUpperCase();
    const normalizedHours = period === "PM" && hours !== 12 ? hours + 12 : hours === 12 && period === "AM" ? 0 : hours;
    return normalizedHours * 60 + minutes;
  }

  const [hoursPart, minutesPart] = text.split(":");
  if (!hoursPart || !minutesPart) return null;
  return Number(hoursPart) * 60 + Number(minutesPart);
}

function formatWorkingHours(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes) || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatDelay(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes) || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

function matchesText(value: string | undefined, search: string) {
  if (!search) return true;
  return value?.toLowerCase().includes(search.toLowerCase()) ?? false;
}

// "Late" is per-employee (employees.daily_start_time), not a hardcoded 9:00 cutoff --
// every helper below that needs a late/on-time verdict takes an employeeMap built from
// this and looks up the record's own employee's expected start time.
function buildEmployeeMap(employees: Employee[]) {
  return new Map(employees.map((employee) => [employee.id, employee]));
}

function isRecordLate(record: AttendanceRecord, employeeMap: Map<string | undefined, Employee>) {
  const employee = employeeMap.get(record.employeeId);
  if (!employee) return false;
  return isLateArrival(record.checkInTime, employee.dailyStartTime);
}

function recordDelayMinutes(record: AttendanceRecord, employeeMap: Map<string | undefined, Employee>) {
  const employee = employeeMap.get(record.employeeId);
  if (!employee) return null;
  return minutesLate(record.checkInTime, employee.dailyStartTime);
}

function isRecordEarly(record: AttendanceRecord, employeeMap: Map<string | undefined, Employee>) {
  const employee = employeeMap.get(record.employeeId);
  if (!employee) return false;
  return isEarlyLeaver(record.checkOutTime, employee.dailyEndTime);
}

function recordEarlyMinutes(record: AttendanceRecord, employeeMap: Map<string | undefined, Employee>) {
  const employee = employeeMap.get(record.employeeId);
  if (!employee) return null;
  return minutesEarly(record.checkOutTime, employee.dailyEndTime);
}

function filterEmployees(employees: Employee[], filters: DashboardFilters) {
  return employees.filter((employee) => {
    const matchesSearch =
      matchesText(employee.employeeName, filters.search) ||
      matchesText(employee.employeeCode, filters.search) ||
      matchesText(employee.designation, filters.search);

    const matchesDesignation = !filters.designation || employee.designation === filters.designation;
    const matchesStatus = !filters.status || employee.status === filters.status;

    return matchesSearch && matchesDesignation && matchesStatus;
  });
}

function filterSites(sites: Site[], filters: DashboardFilters) {
  return sites.filter((site) => {
    const matchesSearch = matchesText(site.siteName, filters.search) || matchesText(site.siteCode, filters.search);
    const matchesStatus = !filters.status || site.status === filters.status;

    return matchesSearch && matchesStatus;
  });
}

function filterRecords(records: AttendanceRecord[], filters: DashboardFilters) {
  const { startDate, endDate } = getEffectiveDateRange(filters);

  return records.filter((record) => {
    const matchesDate = isDateInRange(record.attendanceDate, startDate, endDate);
    const matchesSearch =
      matchesText(record.employeeName, filters.search) ||
      matchesText(record.employeeCode, filters.search) ||
      matchesText(record.siteName, filters.search) ||
      matchesText(record.siteCode, filters.search);

    const matchesEmployee = !filters.employeeId || record.employeeId === filters.employeeId;
    const matchesDesignation = !filters.designation || record.designation === filters.designation;
    const matchesStatus = !filters.status || record.status === filters.status;
    const matchesSite = !filters.siteId || record.siteId === filters.siteId;

    return matchesDate && matchesSearch && matchesEmployee && matchesDesignation && matchesStatus && matchesSite;
  });
}

function getAssignedEmployees(employees: Employee[], filters: DashboardFilters) {
  return employees.filter((employee) => {
    if (!employee.siteId) return false;
    if (employee.status !== "Active") return false;
    if (filters.siteId && employee.siteId !== filters.siteId) return false;
    return true;
  });
}

function getPresentRecords(records: AttendanceRecord[]) {
  return records.filter((record) => record.status === "Checked In" || record.status === "Completed");
}

export function getDashboardSummary(
  records: AttendanceRecord[],
  employees: Employee[],
  sites: Site[],
  filters: DashboardFilters
): DashboardSummary {
  const employeeMap = buildEmployeeMap(employees);
  const filteredEmployees = filterEmployees(employees, filters);
  const filteredSites = filterSites(sites, filters);
  const filteredRecords = filterRecords(records, filters);
  const assignedEmployees = new Set(getAssignedEmployees(employees, filters).map((employee) => employee.id));
  const lateArrivals = filteredRecords.filter((record) => isRecordLate(record, employeeMap)).length;
  const earlyLeavers = filteredRecords.filter((record) => isRecordEarly(record, employeeMap)).length;

  const today = toLocalDateInput(new Date());
  const todayRecords = filteredRecords.filter((record) => record.attendanceDate === today);
  const todayPresentRecords = getPresentRecords(todayRecords);
  const todayPresentEmployees = new Set(todayPresentRecords.map((record) => record.employeeId));
  const checkedIn = todayRecords.filter((record) => record.status === "Checked In").length;
  const checkedOut = todayRecords.filter((record) => record.status === "Completed").length;
  const presentToday = todayPresentRecords.length;
  const absentToday = Math.max(0, assignedEmployees.size - todayPresentEmployees.size);
  const attendancePercentage = assignedEmployees.size > 0 ? Math.round((presentToday / assignedEmployees.size) * 100) : 0;

  return {
    totalEmployees: filteredEmployees.length,
    activeEmployees: filteredEmployees.filter((employee) => employee.status === "Active").length,
    inactiveEmployees: filteredEmployees.filter((employee) => employee.status === "Inactive").length,
    totalSites: filteredSites.length,
    activeSites: filteredSites.filter((site) => site.status === "Active").length,
    employeesAssigned: assignedEmployees.size,
    present: presentToday,
    absent: absentToday,
    presentToday,
    absentToday,
    checkedIn,
    checkedOut,
    lateArrivals,
    earlyLeavers,
    attendancePercentage,
  };
}

export function getAttendanceSummary(records: AttendanceRecord[], employees: Employee[], filters: DashboardFilters): AttendanceSummary {
  const employeeMap = buildEmployeeMap(employees);
  const filteredRecords = filterRecords(records, filters);
  const presentRecords = getPresentRecords(filteredRecords);
  const assignedCount = getAssignedEmployees(employees, filters).length;
  const presentCount = presentRecords.length;
  const checkedIn = filteredRecords.filter((record) => record.status === "Checked In").length;
  const checkedOut = filteredRecords.filter((record) => record.status === "Completed").length;
  const attendancePercentage = assignedCount > 0 ? Math.round((presentCount / assignedCount) * 100) : 0;

  return {
    present: presentCount,
    absent: Math.max(0, assignedCount - presentCount),
    late: filteredRecords.filter((record) => isRecordLate(record, employeeMap)).length,
    early: filteredRecords.filter((record) => isRecordEarly(record, employeeMap)).length,
    checkedIn,
    checkedOut,
    attendancePercentage,
  };
}

export function getSiteAttendance(
  records: AttendanceRecord[],
  employees: Employee[],
  sites: Site[],
  filters: DashboardFilters
): SiteAttendanceRow[] {
  const employeeMap = buildEmployeeMap(employees);
  const filteredRecords = filterRecords(records, filters);
  const filteredSites = filterSites(sites, filters);
  const assigned = getAssignedEmployees(employees, filters);

  return filteredSites
    .map((site) => {
      const assignedEmployees = new Set(assigned.filter((employee) => employee.siteId === site.id).map((employee) => employee.id));
      const siteRecords = filteredRecords.filter((record) => record.siteId === site.id);
      const presentRecords = getPresentRecords(siteRecords);
      const presentEmployees = new Set(presentRecords.map((record) => record.employeeId));
      const present = presentRecords.length;
      const absent = Math.max(0, assignedEmployees.size - presentEmployees.size);
      const late = siteRecords.filter((record) => isRecordLate(record, employeeMap)).length;
      const early = siteRecords.filter((record) => isRecordEarly(record, employeeMap)).length;
      const attendancePercentage = assignedEmployees.size > 0 ? Math.round((present / assignedEmployees.size) * 100) : 0;

      return {
        siteId: site.id || "",
        siteCode: site.siteCode,
        siteName: site.siteName,
        assignedEmployees: assignedEmployees.size,
        present,
        absent,
        late,
        early,
        attendancePercentage,
      };
    })
    .sort((a, b) => b.present - a.present);
}

export function getEmployeeAttendance(
  records: AttendanceRecord[],
  employees: Employee[],
  sites: Site[],
  filters: DashboardFilters
): EmployeeAttendanceRow[] {
  const filteredEmployees = filterEmployees(employees, filters);
  const filteredRecords = filterRecords(records, filters);
  const siteMap = new Map(sites.map((site) => [site.id, site]));

  return filteredEmployees.map((employee) => {
    const latestRecord = [...filteredRecords]
      .filter((record) => record.employeeId === employee.id)
      .sort((left, right) => (left.attendanceDate > right.attendanceDate ? -1 : 1))[0];

    const assignedSite = siteMap.get(employee.siteId ?? "")?.siteName ?? "—";
    const checkInTime = latestRecord?.checkInTime || "—";
    const checkOutTime = latestRecord?.checkOutTime || "—";
    const workingHours =
      latestRecord?.checkInTime && latestRecord?.checkOutTime
        ? formatWorkingHours(parseTimeToMinutes(latestRecord.checkOutTime)! - parseTimeToMinutes(latestRecord.checkInTime)!)
        : "—";
    const attendanceStatus = latestRecord?.status || "Absent";
    const gpsStatus = latestRecord && latestRecord.checkInLatitude && latestRecord.checkInLongitude ? "Verified" : "Pending";
    const faceStatus = latestRecord?.checkInFaceStatus
      ? latestRecord.checkInFaceStatus[0].toUpperCase() + latestRecord.checkInFaceStatus.slice(1)
      : "—";

    return {
      employeeId: employee.id || "",
      employeeCode: employee.employeeCode,
      employeeName: employee.employeeName,
      designation: employee.designation,
      assignedSite,
      checkInTime,
      checkOutTime,
      workingHours,
      attendanceStatus,
      gpsStatus,
      faceStatus,
    };
  });
}

export function getLateArrivals(records: AttendanceRecord[], employees: Employee[], sites: Site[], filters: DashboardFilters): LateArrivalRow[] {
  const employeeMap = buildEmployeeMap(employees);
  const filteredRecords = filterRecords(records, filters);
  const siteMap = new Map(sites.map((site) => [site.id, site]));

  return filteredRecords
    .filter((record) => isRecordLate(record, employeeMap))
    .map((record) => ({
      employeeName: record.employeeName,
      siteName: siteMap.get(record.siteId)?.siteName || record.siteName,
      checkInTime: record.checkInTime || "—",
      delay: formatDelay(recordDelayMinutes(record, employeeMap)),
    }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));
}

export function getEarlyLeavers(records: AttendanceRecord[], employees: Employee[], sites: Site[], filters: DashboardFilters): EarlyLeaverRow[] {
  const employeeMap = buildEmployeeMap(employees);
  const filteredRecords = filterRecords(records, filters);
  const siteMap = new Map(sites.map((site) => [site.id, site]));

  return filteredRecords
    .filter((record) => isRecordEarly(record, employeeMap))
    .map((record) => ({
      employeeName: record.employeeName,
      siteName: siteMap.get(record.siteId)?.siteName || record.siteName,
      checkOutTime: record.checkOutTime || "—",
      early: formatDelay(recordEarlyMinutes(record, employeeMap)),
    }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));
}

export function getAttendanceTrend(records: AttendanceRecord[], employees: Employee[], filters: DashboardFilters): AttendanceTrendPoint[] {
  const employeeMap = buildEmployeeMap(employees);
  const filteredRecords = filterRecords(records, filters);
  const { startDate, endDate } = getEffectiveDateRange(filters);
  const points: AttendanceTrendPoint[] = [];
  const dateCursor = new Date(`${startDate}T00:00:00`);
  const lastDate = new Date(`${endDate}T00:00:00`);

  while (dateCursor <= lastDate) {
    const day = toLocalDateInput(dateCursor);
    const dayRecords = filteredRecords.filter((record) => record.attendanceDate === day);
    const present = getPresentRecords(dayRecords).length;
    const absent = Math.max(0, dayRecords.length - present);
    const late = dayRecords.filter((record) => isRecordLate(record, employeeMap)).length;
    const early = dayRecords.filter((record) => isRecordEarly(record, employeeMap)).length;

    points.push({ date: day, present, absent, late, early });
    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  return points;
}

export async function exportExcel(payload: ExportReportPayload) {
  const workbook = utils.book_new();
  const sheet = utils.json_to_sheet(payload.rows);

  utils.book_append_sheet(workbook, sheet, payload.reportType);
  writeFile(workbook, `${payload.reportType}.xlsx`);
  toast.success(`${payload.title} exported to Excel`);
}

export async function exportPDF(payload: ExportReportPayload) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const title = payload.title;
  const generatedDate = new Date().toLocaleDateString();

  doc.setFontSize(18);
  doc.text(title, 40, 36);
  doc.setFontSize(10);
  doc.text(`Company: Attendance Management System`, 40, 56);
  doc.text(`Generated: ${generatedDate}`, 40, 72);
  doc.text(`Filters: ${JSON.stringify(payload.filters)}`, 40, 88);

  const headers = payload.headers;
  const rows = payload.rows.map((row) => headers.map((header) => String(row[header] ?? "")));

  autoTable(doc, {
    startY: 108,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [29, 78, 216] },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 20);
    },
  });

  doc.save(`${payload.reportType}.pdf`);
  toast.success(`${payload.title} generated as PDF`);
}
