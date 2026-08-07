"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { getCurrentAdminId } from "@/lib/currentAdmin";
import { getAttendanceForCycleWindow } from "@/services/attendanceVerification.service";
import { subscribeEmployees } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import {
  finalizeSalaryCycle,
  getFinalizeChecklist,
  markSalaryCyclePaid,
  reopenSalaryCycle,
  subscribeSalaryCycles,
} from "@/services/salaryCycle.service";
import { computeAndUpsertPreview, subscribeSalaryRecordsForCycle } from "@/services/salaryRecord.service";
import { generateSalarySlipPDF } from "@/services/salarySlip.service";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { SalaryCycle, SalaryRecord } from "@/types/salary";
import AttendanceVerificationPanel from "./AttendanceVerificationPanel";
import FinalizeChecklist from "./FinalizeChecklist";
import ReopenCycleDialog from "./ReopenCycleDialog";
import SalaryGrid from "./SalaryGrid";

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getStatusBadgeClass(status: SalaryCycle["status"]) {
  switch (status) {
    case "Finalized":
      return "bg-amber-50 text-amber-700";
    case "Paid":
      return "bg-emerald-50 text-emerald-700";
    case "Draft":
    default:
      return "bg-sky-50 text-sky-700";
  }
}

export default function SalaryCycleWorkspace({ cycleId }: { cycleId: string }) {
  const [cycles, setCycles] = useState<SalaryCycle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const cycle = useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);

  useEffect(() => {
    const unsubscribeCycles = subscribeSalaryCycles(setCycles);
    const unsubscribeEmployees = subscribeEmployees(setEmployees);
    const unsubscribeSites = subscribeSites(setSites);
    const unsubscribeRecords = subscribeSalaryRecordsForCycle(cycleId, setRecords);

    return () => {
      unsubscribeCycles();
      unsubscribeEmployees();
      unsubscribeSites();
      unsubscribeRecords();
    };
  }, [cycleId]);

  const refetchAttendance = useCallback(async () => {
    if (!cycle) return;
    const rows = await getAttendanceForCycleWindow(cycle.fromDate, cycle.toDate);
    setAttendance(rows);
  }, [cycle]);

  // Direct .then() rather than `void refetchAttendance()` so this stays a plain async
  // data-load effect (matching the pattern elsewhere in this codebase) instead of a
  // synchronous setState call flagged by react-hooks/set-state-in-effect. refetchAttendance
  // itself is still reused as the onChanged callback passed to child components below.
  useEffect(() => {
    if (!cycle) return;
    getAttendanceForCycleWindow(cycle.fromDate, cycle.toDate).then(setAttendance);
  }, [cycle]);

  const checklist = useMemo(() => {
    if (!cycle) return null;
    return getFinalizeChecklist(cycle, attendance, records, employees);
  }, [cycle, attendance, records, employees]);

  const handleRecomputePreview = useCallback(async () => {
    if (!cycle) return;
    const frozen = attendance.filter((a) => a.salaryVerificationStatus === "Frozen");
    await computeAndUpsertPreview(cycle, frozen, employees, sites);
  }, [cycle, attendance, employees, sites]);

  const handleFinalize = async () => {
    if (!cycle?.id) return;
    setIsFinalizing(true);
    try {
      const adminId = await getCurrentAdminId();
      await finalizeSalaryCycle(cycle.id, adminId);
      toast.success("Salary cycle finalized");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to finalize salary cycle.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleReopen = async (reason: string) => {
    if (!cycle?.id) return;
    const adminId = await getCurrentAdminId();
    await reopenSalaryCycle(cycle.id, adminId, reason);
    toast.success("Salary cycle reopened");
    void refetchAttendance();
  };

  const handleMarkPaid = async () => {
    if (!cycle?.id) return;
    setIsPaying(true);
    try {
      const adminId = await getCurrentAdminId();
      await markSalaryCyclePaid(cycle.id, adminId);
      toast.success("Salary cycle marked Paid");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark salary cycle as paid.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleGenerateAllSlips = () => {
    if (!cycle) return;
    for (const record of records) {
      generateSalarySlipPDF(record, cycle);
    }
  };

  if (!cycle) {
    return (
      <AppCard title="Salary Cycle">
        <p className="text-sm text-slate-500">Loading cycle…</p>
      </AppCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/dashboard/salary" className="text-xs font-medium uppercase tracking-[0.28em] text-slate-500">
              ← All Salary Cycles
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              {formatDateLabel(cycle.fromDate)} – {formatDateLabel(cycle.toDate)}
            </h1>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(cycle.status)}`}>
              {cycle.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cycle.status === "Draft" && (
              <Button onClick={handleFinalize} disabled={isFinalizing || !checklist?.allPassed}>
                {isFinalizing ? "Finalizing..." : "Finalize Salary"}
              </Button>
            )}
            {(cycle.status === "Finalized" || cycle.status === "Paid") && (
              <Button variant="outline" onClick={() => setReopenOpen(true)}>
                Reopen
              </Button>
            )}
            {cycle.status === "Finalized" && (
              <Button onClick={handleMarkPaid} disabled={isPaying}>
                {isPaying ? "Marking..." : "Mark Cycle Paid"}
              </Button>
            )}
            {(cycle.status === "Finalized" || cycle.status === "Paid") && records.length > 0 && (
              <Button variant="outline" onClick={handleGenerateAllSlips}>
                Generate All Slips
              </Button>
            )}
          </div>
        </div>
      </div>

      {cycle.status === "Draft" && checklist && (
        <AppCard title="Finalize Checklist" description="All checks must pass before this cycle can be finalized.">
          <FinalizeChecklist checklist={checklist} />
        </AppCard>
      )}

      <AttendanceVerificationPanel
        fromDate={cycle.fromDate}
        toDate={cycle.toDate}
        cycleIsDraft={cycle.status === "Draft"}
        attendance={attendance}
        onChanged={refetchAttendance}
      />

      <SalaryGrid
        cycle={cycle}
        records={records}
        canRecompute={cycle.status === "Draft"}
        onRecompute={handleRecomputePreview}
        onChanged={refetchAttendance}
      />

      <ReopenCycleDialog open={reopenOpen} onOpenChange={setReopenOpen} onConfirm={handleReopen} />
    </div>
  );
}
