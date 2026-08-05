"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTodayDate } from "@/lib/attendanceMath";
import { deleteAttendance, subscribeAttendance, updateAttendance } from "@/services/attendance.service";
import { subscribeEmployees } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import { getHolidayDateSetsForRange } from "@/services/holiday.service";
import type { AttendanceRecord, FaceStatus } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import { isLateArrival, minutesLate, isEarlyLeaver, minutesEarly } from "@/lib/attendanceMath";

type AttendanceDisplayStatus = "Present" | "Half Day" | "Absent" | "Working" | "Holiday";
// Holiday rows never carry a real attendance record (see `record: undefined` in the
// absentRows synthesis below), so there's nothing to edit -- the edit dialog only
// ever deals with the four persistable statuses.
type AttendanceEditStatus = Exclude<AttendanceDisplayStatus, "Holiday">;

interface AttendanceRow {
  id: string;
  attendanceDate: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  serialNo?: number;
  designation: string;
  mobileNumber: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours: string;
  attendanceStatus: AttendanceDisplayStatus;
  remarks: string;
  isLate: boolean;
  minutesLate: number | null;
  isEarly: boolean;
  minutesEarly: number | null;
  faceStatus: FaceStatus | null;
  record?: AttendanceRecord;
}

function formatDateLabel(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getDisplayValue(value?: string) {
  return value && value.trim() ? value : "—";
}

function normalizeTimeInput(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower.includes("am") || lower.includes("pm")) {
    const [timePart, modifier] = trimmed.split(" ");
    const [rawHours, rawMinutes] = timePart.split(":");
    let hours = Number(rawHours);
    const minutes = Number(rawMinutes || 0);
    if (modifier === "pm" && hours < 12) hours += 12;
    if (modifier === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const [rawHours, rawMinutes] = trimmed.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTimeToMinutes(value?: string) {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return null;
  const [rawHours, rawMinutes] = normalized.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function calculateTotalMinutes(checkInTime?: string, checkOutTime?: string) {
  const start = parseTimeToMinutes(checkInTime);
  const end = parseTimeToMinutes(checkOutTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function formatDurationMinutes(totalMinutes: number | null) {
  if (totalMinutes === null) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function calculateTotalHours(checkInTime?: string, checkOutTime?: string) {
  return formatDurationMinutes(calculateTotalMinutes(checkInTime, checkOutTime));
}

function formatDelayLabel(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes) || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

function calculateShiftMinutes(dailyStartTime?: string, dailyEndTime?: string) {
  const start = parseTimeToMinutes(dailyStartTime);
  const end = parseTimeToMinutes(dailyEndTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function toAttendanceStatus(record: AttendanceRecord, employee?: Employee): AttendanceDisplayStatus {
  if (record.status === "Absent") return "Absent";
  if (record.status === "Checked In") return "Working";

  // status === "Completed": has both check-in and check-out
  const workedMinutes = calculateTotalMinutes(record.checkInTime, record.checkOutTime);
  const shiftMinutes = calculateShiftMinutes(employee?.dailyStartTime, employee?.dailyEndTime);

  if (workedMinutes === null) return "Present";
  if (shiftMinutes && workedMinutes < shiftMinutes * 0.5) return "Half Day";
  return "Present";
}

function getRemarks(record: AttendanceRecord, status: AttendanceDisplayStatus, totalHours: string) {
  if (record.remarks && record.remarks.trim()) return record.remarks;
  if (status === "Working") return "Currently working";
  if (status === "Present") return totalHours === "—" ? "Completed without duration" : "Completed";
  if (status === "Half Day") return "Partial attendance";
  return "Marked absent";
}

function getStatusBadgeClass(status: AttendanceDisplayStatus) {
  switch (status) {
    case "Present":
      return "bg-emerald-50 text-emerald-700";
    case "Half Day":
      return "bg-amber-50 text-amber-700";
    case "Working":
      return "bg-sky-50 text-sky-700";
    case "Holiday":
      return "bg-violet-50 text-violet-700";
    case "Absent":
    default:
      return "bg-rose-50 text-rose-700";
  }
}

const faceStatusLabel: Record<FaceStatus, string> = {
  verified: "Verified",
  unverified: "Needs review",
  service_error: "Service error",
};

function getFaceBadgeClass(status: FaceStatus) {
  return status === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
}

export default function AttendanceManagementPage() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [statusFilter, setStatusFilter] = useState<AttendanceDisplayStatus | "All">("All");
  const [editingRecord, setEditingRecord] = useState<AttendanceRow | null>(null);
  const [editCheckInTime, setEditCheckInTime] = useState("");
  const [editCheckOutTime, setEditCheckOutTime] = useState("");
  const [editAttendanceStatus, setEditAttendanceStatus] = useState<AttendanceEditStatus>("Present");
  const [editRemarks, setEditRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [holidaysBySite, setHolidaysBySite] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    const unsubscribeAttendance = subscribeAttendance((next) => setAttendanceRecords(next));
    const unsubscribeEmployees = subscribeEmployees((next) => setEmployees(next));
    const unsubscribeSites = subscribeSites((next) => setSites(next));

    return () => {
      unsubscribeAttendance();
      unsubscribeEmployees();
      unsubscribeSites();
    };
  }, []);

  useEffect(() => {
    const siteIds = sites.map((site) => site.id).filter((id): id is string => Boolean(id));
    if (siteIds.length === 0) return;

    getHolidayDateSetsForRange(siteIds, selectedDate, selectedDate)
      .then(setHolidaysBySite)
      .catch(() => setHolidaysBySite(new Map()));
  }, [selectedDate, sites]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((employee) => employee.id && map.set(employee.id, employee));
    return map;
  }, [employees]);

  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach((site) => site.id && map.set(site.id, site));
    return map;
  }, [sites]);

  const selectedDateRecords = useMemo(
    () => attendanceRecords.filter((record) => record.attendanceDate === selectedDate),
    [attendanceRecords, selectedDate]
  );

  const assignedEmployees = useMemo(() => {
    return employees.filter((employee) => employee.status === "Active" && Boolean(employee.siteId));
  }, [employees]);

  const attendanceRows = useMemo<AttendanceRow[]>(() => {
    const recordRows = selectedDateRecords.map((record) => {
      const employee = employeeMap.get(record.employeeId);
      const attendanceStatus = toAttendanceStatus(record, employee);
      const totalHours = calculateTotalHours(record.checkInTime, record.checkOutTime);
      const isLate = employee ? isLateArrival(record.checkInTime, employee.dailyStartTime) : false;
      const lateMinutes = employee ? minutesLate(record.checkInTime, employee.dailyStartTime) : null;
      const isEarly = employee ? isEarlyLeaver(record.checkOutTime, employee.dailyEndTime) : false;
      const earlyMinutes = employee ? minutesEarly(record.checkOutTime, employee.dailyEndTime) : null;

      return {
        id: record.id ?? `${record.employeeId}-${record.attendanceDate}`,
        attendanceDate: record.attendanceDate,
        employeeId: record.employeeId,
        employeeCode: record.employeeCode,
        employeeName: record.employeeName,
        serialNo: employee?.serialNo,
        designation: employee?.designation ?? record.designation,
        mobileNumber: employee?.mobileNumber ?? "—",
        siteId: record.siteId,
        siteCode: record.siteCode,
        siteName: record.siteName,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        totalHours,
        attendanceStatus,
        remarks: getRemarks(record, attendanceStatus, totalHours),
        isLate,
        minutesLate: lateMinutes,
        isEarly,
        minutesEarly: earlyMinutes,
        faceStatus: record.checkInFaceStatus ?? null,
        record,
      };
    });

    const recordedEmployeeIds = new Set(selectedDateRecords.map((record) => record.employeeId));

    const absentRows: AttendanceRow[] = assignedEmployees
      .filter((employee) => employee.id && !recordedEmployeeIds.has(employee.id))
      .map((employee) => {
        const site = employee.siteId ? siteMap.get(employee.siteId) : undefined;
        const isOnHoliday = Boolean(site?.id && holidaysBySite.get(site.id)?.has(selectedDate));
        const attendanceStatus: AttendanceDisplayStatus = isOnHoliday ? "Holiday" : "Absent";

        return {
          id: `absent-${employee.id}-${selectedDate}`,
          attendanceDate: selectedDate,
          employeeId: employee.id ?? "",
          employeeCode: employee.employeeCode,
          employeeName: employee.employeeName,
          serialNo: employee.serialNo,
          designation: employee.designation,
          mobileNumber: employee.mobileNumber,
          siteId: site?.id ?? "",
          siteCode: site?.siteCode ?? "—",
          siteName: site?.siteName ?? "—",
          checkInTime: undefined,
          checkOutTime: undefined,
          totalHours: "—",
          attendanceStatus,
          remarks: isOnHoliday ? "Holiday" : "Not marked",
          isLate: false,
          minutesLate: null,
          isEarly: false,
          minutesEarly: null,
          faceStatus: null,
          record: undefined,
        };
      });

    return [...recordRows, ...absentRows];
  }, [selectedDateRecords, employeeMap, siteMap, assignedEmployees, selectedDate, holidaysBySite]);

  const filteredRows = useMemo(() => {
    return attendanceRows.filter((row) => {
      const employeeMatches = selectedEmployeeId ? row.employeeId === selectedEmployeeId : true;
      const siteMatches = selectedSiteId ? row.siteId === selectedSiteId : true;
      const statusMatches = statusFilter === "All" ? true : row.attendanceStatus === statusFilter;

      return employeeMatches && siteMatches && statusMatches;
    });
  }, [attendanceRows, selectedEmployeeId, selectedSiteId, statusFilter]);

  const resetFilters = () => {
    setSelectedEmployeeId("");
    setSelectedSiteId("");
    setSelectedDate(getTodayDate());
    setStatusFilter("All");
  };

  const openEditDialog = (row: AttendanceRow) => {
    setEditingRecord(row);
    setEditCheckInTime(normalizeTimeInput(row.checkInTime) || "");
    setEditCheckOutTime(normalizeTimeInput(row.checkOutTime) || "");
    setEditAttendanceStatus(
      row.attendanceStatus === "Working" || row.attendanceStatus === "Holiday" ? "Present" : row.attendanceStatus
    );
    setEditRemarks(row.record?.remarks ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editingRecord?.record?.id) return;

    setIsSaving(true);
    try {
      await updateAttendance(editingRecord.record.id, {
        checkInTime: editCheckInTime || undefined,
        checkOutTime: editCheckOutTime || undefined,
        attendanceStatus: editAttendanceStatus,
        remarks: editRemarks,
      });
      toast.success("Attendance Updated");
      setEditingRecord(null);
    } catch {
      toast.error("Unable to update attendance.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttendance = async () => {
    if (!deleteRecordId) return;

    setIsDeleting(true);
    try {
      await deleteAttendance(deleteRecordId);
      toast.success("Attendance Deleted");
      setDeleteRecordId(null);
    } catch {
      toast.error("Unable to delete attendance.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-500">Admin Attendance</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Attendance Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Search, filter, and correct individual attendance records.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="font-semibold text-slate-900">Selected date</span>: {formatDateLabel(selectedDate)}
          </div>
        </div>
      </div>

      <AppCard title="Filters" description="Refine the attendance view by employee, site, date, or status.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Employee</span>
            <select
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeCode} - {employee.employeeName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Godown</span>
            <select
              value={selectedSiteId}
              onChange={(event) => setSelectedSiteId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            >
              <option value="">All godowns</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.siteCode} - {site.siteName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AttendanceDisplayStatus | "All")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            >
              <option value="All">All status</option>
              <option value="Present">Present</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="Working">Working</option>
              <option value="Holiday">Holiday</option>
            </select>
          </label>
        </div>
        <div className="mt-3">
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
            Reset filters
          </Button>
        </div>
      </AppCard>

      <AppCard title="Attendance Records" description="Realtime records.">
        {/* Mobile: stacked cards */}
        <div className="space-y-3 sm:hidden">
          {filteredRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No attendance records match the current filters.</p>
          ) : (
            filteredRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{row.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      {row.employeeCode} • Serial No: {row.serialNo ?? "—"} • {row.siteName}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row.attendanceStatus)}`}>
                    {row.attendanceStatus}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <p>In: {getDisplayValue(row.checkInTime)}</p>
                  <p>Out: {getDisplayValue(row.checkOutTime)}</p>
                  <p>Hours: {row.totalHours}</p>
                  <p>{row.isLate ? `Late ${formatDelayLabel(row.minutesLate)}` : "On time"}</p>
                  {row.isEarly && <p className="text-fuchsia-600">Early • {formatDelayLabel(row.minutesEarly)}</p>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.faceStatus && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getFaceBadgeClass(row.faceStatus)}`}>
                      {faceStatusLabel[row.faceStatus]}
                    </span>
                  )}
                </div>
                {row.record ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium"
                      onClick={() => openEditDialog(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-600"
                      onClick={() => setDeleteRecordId(row.record?.id ?? null)}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-center text-xs text-slate-400">No record to edit</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Godown</th>
                <th className="px-3 py-3">Check-In</th>
                <th className="px-3 py-3">Check-Out</th>
                <th className="px-3 py-3">Hours</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Late</th>
                <th className="px-3 py-3">Early</th>
                <th className="px-3 py-3">Face</th>
                <th className="px-3 py-3">Remarks</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-sm text-slate-500">
                    No attendance records match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-900">{formatDateLabel(row.attendanceDate)}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{row.employeeName}</p>
                      <p className="text-xs text-slate-500">{row.serialNo ?? "—"}</p>
                    </td>
                    <td className="px-3 py-3">{row.siteName}</td>
                    <td className="px-3 py-3">{getDisplayValue(row.checkInTime)}</td>
                    <td className="px-3 py-3">{getDisplayValue(row.checkOutTime)}</td>
                    <td className="px-3 py-3">{row.totalHours}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row.attendanceStatus)}`}>
                        {row.attendanceStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.isLate ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Late • {formatDelayLabel(row.minutesLate)}</span>
                      ) : (
                        <span className="text-slate-500">On time</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.isEarly ? (
                        <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-semibold text-fuchsia-700">Early • {formatDelayLabel(row.minutesEarly)}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {row.faceStatus ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getFaceBadgeClass(row.faceStatus)}`}>
                          {faceStatusLabel[row.faceStatus]}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{row.remarks}</td>
                    <td className="px-3 py-3">
                      {row.record ? (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(row)}>
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteRecordId(row.record?.id ?? null)}>
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AppCard>

      <Dialog open={Boolean(editingRecord)} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">Check-In Time</span>
              <input
                type="time"
                value={editCheckInTime}
                onChange={(event) => setEditCheckInTime(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">Check-Out Time</span>
              <input
                type="time"
                value={editCheckOutTime}
                onChange={(event) => setEditCheckOutTime(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">Attendance Status</span>
              <select
                value={editAttendanceStatus}
                onChange={(event) => setEditAttendanceStatus(event.target.value as AttendanceEditStatus)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
              >
                <option value="Present">Present</option>
                <option value="Half Day">Half Day</option>
                <option value="Absent">Absent</option>
                <option value="Working">Working</option>
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
              <span className="font-medium">Remarks</span>
              <textarea
                value={editRemarks}
                onChange={(event) => setEditRemarks(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
                placeholder="Add admin remarks"
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteRecordId)} onOpenChange={(open) => !open && setDeleteRecordId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">This will remove the selected attendance record and refresh the table immediately.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecordId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAttendance} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
