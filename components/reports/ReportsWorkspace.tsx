"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Filter, SlidersHorizontal, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { subscribeAttendance } from "@/services/attendance.service";
import { subscribeEmployees } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import { getHolidayDateSetsForRange } from "@/services/holiday.service";
import { exportExcel, exportPDF, getAttendanceTrend, getDashboardSummary, toLocalDateInput, type DashboardFilters } from "@/services/dashboard.service";
import { isLateArrival, isEarlyLeaver } from "@/lib/attendanceMath";
import type { AttendanceRecord, FaceStatus } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";

const defaultFilters: DashboardFilters = {
  datePreset: "month",
  startDate: "",
  endDate: "",
  siteId: "",
  employeeId: "",
  designation: "",
  status: "",
  search: "",
};

const reportTypes = [
  { value: "all", label: "All Records" },
  { value: "employee", label: "Employee-wise Report" },
  { value: "site", label: "Godown-wise Report" },
  { value: "late", label: "Late Arrival Report" },
  { value: "early", label: "Early Leaver Report" },
  { value: "absent", label: "Absent Report" },
  { value: "present", label: "Present Report" },
];

const faceStatusFilters = [
  { value: "", label: "All Face Status" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified (needs review)" },
  { value: "service_error", label: "Service Error (needs review)" },
  { value: "not_attempted", label: "Not attempted" },
];

function formatWorkingHours(checkInTime?: string, checkOutTime?: string) {
  if (!checkInTime || !checkOutTime) return "—";
  const parse = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const minutes = parse(checkOutTime) - parse(checkInTime);
  return minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "—";
}

// Keyed by the raw query string from the parent below, so navigating here again from
// a dashboard card (same route, different params) remounts this instead of leaving
// stale reportType/filters state behind -- client-side nav to the same route doesn't
// otherwise remount, and syncing via a setState-in-effect is its own footgun.
function ReportsWorkspaceInner({ searchParams }: { searchParams: URLSearchParams }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [holidaysBySite, setHolidaysBySite] = useState<Map<string, Set<string>>>(new Map());
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    ...defaultFilters,
    siteId: searchParams.get("siteId") || defaultFilters.siteId,
    datePreset: (searchParams.get("datePreset") as DashboardFilters["datePreset"]) || defaultFilters.datePreset,
  }));
  const [reportType, setReportType] = useState(() => searchParams.get("type") || reportTypes[0].value);
  const [faceStatusFilter, setFaceStatusFilter] = useState("");

  // Arriving from a dashboard card already implies the report type/site/date -- start
  // with the filters panel collapsed so the drill-through reads as a direct answer,
  // not another form to fill in. Still reachable via the toggle below.
  const cameFromDashboard = searchParams.get("type") !== null;
  const [showFilters, setShowFilters] = useState(!cameFromDashboard);

  useEffect(() => {
    const unsubscribeAttendance = subscribeAttendance((next) => setRecords(next));
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

    // getDashboardSummary's "Absent Today" tile only ever looks at today's date, so
    // fetching a single-day holiday set here is enough to keep it holiday-aware.
    const today = toLocalDateInput(new Date());
    getHolidayDateSetsForRange(siteIds, today, today)
      .then(setHolidaysBySite)
      .catch(() => setHolidaysBySite(new Map()));
  }, [sites]);

  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const summary = useMemo(
    () => getDashboardSummary(records, employees, sites, filters, holidaysBySite),
    [records, employees, sites, filters, holidaysBySite]
  );
  const trend = useMemo(() => getAttendanceTrend(records, employees, filters), [records, employees, filters]);

  const rows = useMemo(() => {
    const filtered = records.filter((record) => {
      const matchesEmployee = !filters.employeeId || record.employeeId === filters.employeeId;
      const matchesSite = !filters.siteId || record.siteId === filters.siteId;
      const matchesDesignation = !filters.designation || record.designation === filters.designation;
      const matchesStatus = !filters.status || record.status === filters.status;
      const matchesSearch =
        !filters.search ||
        [record.employeeName, record.employeeCode, record.siteName, record.siteCode].some((value) =>
          value?.toLowerCase().includes(filters.search.toLowerCase())
        );
      const matchesDate =
        (!filters.startDate && !filters.endDate) ||
        (record.attendanceDate >= (filters.startDate || "") && record.attendanceDate <= (filters.endDate || record.attendanceDate));

      const employee = employeeMap.get(record.employeeId);
      const isLate = employee ? isLateArrival(record.checkInTime, employee.dailyStartTime) : false;
      const isEarly = employee ? isEarlyLeaver(record.checkOutTime, employee.dailyEndTime) : false;

      const matchesReportType =
        reportType === "all" ||
        reportType === "employee" ||
        reportType === "site" ||
        (reportType === "late" && isLate) ||
        (reportType === "early" && isEarly) ||
        (reportType === "absent" && record.status === "Absent") ||
        (reportType === "present" && (record.status === "Checked In" || record.status === "Completed"));

      const effectiveFaceStatus: string = record.checkInFaceStatus ?? "not_attempted";
      const matchesFaceStatus = !faceStatusFilter || effectiveFaceStatus === faceStatusFilter;

      return matchesEmployee && matchesSite && matchesDesignation && matchesStatus && matchesSearch && matchesDate && matchesReportType && matchesFaceStatus;
    });

    const sorted = [...filtered].sort((left, right) => right.attendanceDate.localeCompare(left.attendanceDate));

    return sorted.map((record) => ({
      attendanceDate: record.attendanceDate,
      serialNo: employeeMap.get(record.employeeId)?.serialNo ?? "—",
      employeeName: record.employeeName,
      designation: record.designation,
      site: record.siteName,
      checkIn: record.checkInTime ?? "—",
      checkOut: record.checkOutTime ?? "—",
      workingHours: formatWorkingHours(record.checkInTime, record.checkOutTime),
      lateArrival: employeeMap.get(record.employeeId) && isLateArrival(record.checkInTime, employeeMap.get(record.employeeId)!.dailyStartTime) ? "Yes" : "No",
      earlyLeaver: employeeMap.get(record.employeeId) && isEarlyLeaver(record.checkOutTime, employeeMap.get(record.employeeId)!.dailyEndTime) ? "Yes" : "No",
      faceStatus: (record.checkInFaceStatus ?? "not_attempted") as FaceStatus | "not_attempted",
      attendanceStatus: record.status,
      idProofLink: employeeMap.get(record.employeeId)?.idProofUrl ?? "—",
    }));
  }, [records, filters, reportType, faceStatusFilter, employeeMap]);

  const headers = [
    "Attendance Date",
    "Serial No",
    "Employee Name",
    "Designation",
    "Godown",
    "Check-In",
    "Check-Out",
    "Working Hours",
    "Late Arrival",
    "Early Leaver",
    "Face Status",
    "Attendance Status",
    "ID Proof Link",
  ];

  const tableRows = rows.map((row) =>
    headers.map((header) => {
      switch (header) {
        case "Attendance Date":
          return row.attendanceDate;
        case "Serial No":
          return row.serialNo;
        case "Employee Name":
          return row.employeeName;
        case "Designation":
          return row.designation;
        case "Godown":
          return row.site;
        case "Check-In":
          return row.checkIn;
        case "Check-Out":
          return row.checkOut;
        case "Working Hours":
          return row.workingHours;
        case "Late Arrival":
          return row.lateArrival;
        case "Early Leaver":
          return row.earlyLeaver;
        case "Face Status":
          return row.faceStatus;
        case "Attendance Status":
          return row.attendanceStatus;
        case "ID Proof Link":
          return row.idProofLink;
        default:
          return "";
      }
    })
  );

  const reportTypeLabel = reportTypes.find((item) => item.value === reportType)?.label ?? reportTypes[0].label;
  const selectedSiteName = filters.siteId ? sites.find((site) => site.id === filters.siteId)?.siteName ?? "—" : "All Godowns";

  const handleExport = async (format: "excel" | "pdf") => {
    const payload = {
      title: `${reportType} Report`,
      rows,
      headers,
      reportType: `${reportType}-report`,
      filters,
    };

    if (format === "excel") {
      await exportExcel(payload);
      toast.success("Exported filtered records to Excel");
    } else {
      await exportPDF(payload);
      toast.success("Exported filtered records to PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <Button variant="outline" size="sm" onClick={() => setShowFilters((prev) => !prev)}>
          <SlidersHorizontal className="mr-2 h-4 w-4" /> {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <h1 className="text-2xl font-semibold sm:text-3xl">{reportTypeLabel}</h1>
        <p className="mt-1 text-sm text-slate-300">Godown: {selectedSiteName}</p>
      </div>

      {showFilters && (
        <AppCard title="Report Filters" description="Filter by employee, site, date range, attendance status, and face verification status.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Report Type</span>
            <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {reportTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Employee</span>
            <select
              value={filters.employeeId}
              onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Godown</span>
            <select
              value={filters.siteId}
              onChange={(event) => setFilters({ ...filters, siteId: event.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All Godowns</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.siteName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Face Status</span>
            <select value={faceStatusFilter} onChange={(event) => setFaceStatusFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {faceStatusFilters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Start Date</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">End Date</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm sm:col-span-2 xl:col-span-2">
            <span className="font-medium text-slate-700">Search</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="Search by employee, code, site"
                className="w-full border-0 bg-transparent text-sm outline-none"
              />
            </div>
          </label>
        </div>
        </AppCard>
      )}

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter className="h-4 w-4" />
          <span>{rows.length} filtered records</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleExport("excel")} className="flex-1 sm:flex-none">
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")} className="flex-1 sm:flex-none">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <AppCard title="Report Table" description="Attendance details for the active view.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  {headers.map((header) => (
                    <th key={header} className="px-3 py-2 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  tableRows.map((cells, index) => (
                    <tr key={`${rows[index].serialNo}-${rows[index].attendanceDate}-${index}`} className="border-t border-slate-200">
                      {cells.map((cell, cellIndex) => (
                        <td key={`${headers[cellIndex]}-${index}`} className="px-3 py-2 whitespace-nowrap">
                          {String(cell ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={headers.length} className="px-3 py-8 text-center text-slate-500">
                      No records for the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard title="Report Summary" description="Snapshot aligned to the current filters.">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <span className="text-sm text-slate-600">Present Today</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">{summary.presentToday}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-600" />
                <span className="text-sm text-slate-600">Absent Today</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">{summary.absentToday}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-slate-600">Trend Points</span>
              </div>
              <span className="text-lg font-semibold text-slate-900">{trend.length}</span>
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}

export default function ReportsWorkspace() {
  const searchParams = useSearchParams();
  return <ReportsWorkspaceInner key={searchParams.toString()} searchParams={searchParams} />;
}
