"use client";

import { useEffect, useMemo, useState } from "react";
import SummaryCards from "@/components/dashboard/SummaryCards";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import { subscribeAttendance } from "@/services/attendance.service";
import { subscribeEmployees } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import { subscribeEmployeeSiteMappings } from "@/services/employeeSiteMapping.service";
import {
  getDashboardSummary,
  type DashboardFilters as DashboardFilterState,
} from "@/services/dashboard.service";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { EmployeeSiteMapping } from "@/types/employeeSiteMapping";
import type { Site } from "@/types/site";

const defaultFilters: DashboardFilterState = {
  datePreset: "today",
  startDate: "",
  endDate: "",
  siteId: "",
  employeeId: "",
  designation: "",
  status: "",
  client: "",
  search: "",
};

export default function DashboardOverview() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [mappings, setMappings] = useState<EmployeeSiteMapping[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filters, setFilters] = useState<DashboardFilterState>(defaultFilters);

  useEffect(() => {
    const unsubEmployees = subscribeEmployees((next) => setEmployees(next));
    const unsubSites = subscribeSites((next) => setSites(next));
    const unsubMappings = subscribeEmployeeSiteMappings((next) => setMappings(next));
    const unsubAttendance = subscribeAttendance((next) => setRecords(next));

    return () => {
      unsubEmployees();
      unsubSites();
      unsubMappings();
      unsubAttendance();
    };
  }, []);

  const summary = useMemo(() => getDashboardSummary(records, employees, sites, mappings, filters), [records, employees, sites, mappings, filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Realtime operations</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">Live insights for employees, sites, mappings, and attendance.</p>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-slate-100">
            <span className="mr-2 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /> Live
          </div>
        </div>
      </div>

      <DashboardFilters filters={filters} sites={sites} onFiltersChange={setFilters} />

      <SummaryCards summary={summary} />
    </div>
  );
}
