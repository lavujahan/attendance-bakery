"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { getCurrentAdminId } from "@/lib/currentAdmin";
import { freezeAttendanceRange, verifyAttendanceRange } from "@/services/attendanceVerification.service";
import type { AttendanceRecord } from "@/types/attendance";

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getVerificationBadgeClass(record: AttendanceRecord) {
  if (record.isPendingCorrection) return "bg-rose-50 text-rose-700";
  switch (record.salaryVerificationStatus) {
    case "Frozen":
      return "bg-emerald-50 text-emerald-700";
    case "Verified":
      return "bg-sky-50 text-sky-700";
    case "Draft":
    default:
      return "bg-slate-100 text-slate-600";
  }
}

interface AttendanceVerificationPanelProps {
  fromDate: string;
  toDate: string;
  cycleIsDraft: boolean;
  attendance: AttendanceRecord[];
  onChanged: () => void;
}

// Draft -> Verified -> Frozen. Pending Correction rows (missing checkout) are always
// excluded from bulk Verify/Freeze -- the admin fixes them in Attendance Management, then
// re-runs Verify here once the correction lands.
export default function AttendanceVerificationPanel({
  fromDate,
  toDate,
  cycleIsDraft,
  attendance,
  onChanged,
}: AttendanceVerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const pendingCorrections = useMemo(() => attendance.filter((a) => a.isPendingCorrection), [attendance]);
  const draftCount = useMemo(
    () => attendance.filter((a) => a.salaryVerificationStatus === "Draft" && !a.isPendingCorrection).length,
    [attendance]
  );
  const verifiedCount = useMemo(
    () => attendance.filter((a) => a.salaryVerificationStatus === "Verified").length,
    [attendance]
  );
  const frozenCount = useMemo(
    () => attendance.filter((a) => a.salaryVerificationStatus === "Frozen").length,
    [attendance]
  );

  const visibleRows = showOnlyPending ? pendingCorrections : attendance;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const adminId = await getCurrentAdminId();
      const result = await verifyAttendanceRange(fromDate, toDate, adminId);
      toast.success(`Verified ${result.verified} record(s)${result.skippedPending ? `, skipped ${result.skippedPending} pending correction(s)` : ""}`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to verify attendance.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFreeze = async () => {
    setIsFreezing(true);
    try {
      const adminId = await getCurrentAdminId();
      const result = await freezeAttendanceRange(fromDate, toDate, adminId);
      toast.success(`Froze ${result.frozen} record(s)`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to freeze attendance.");
    } finally {
      setIsFreezing(false);
    }
  };

  return (
    <AppCard
      title="Attendance Verification"
      description="Salary is calculated only from Frozen attendance. Verify, then Freeze, before opening the salary grid."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">Draft: {draftCount}</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">Verified: {verifiedCount}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Frozen: {frozenCount}</span>
          {pendingCorrections.length > 0 && (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              Pending Correction: {pendingCorrections.length}
            </span>
          )}
        </div>
        {cycleIsDraft && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleVerify} disabled={isVerifying || draftCount === 0}>
              {isVerifying ? "Verifying..." : "Verify Ready Rows"}
            </Button>
            <Button size="sm" onClick={handleFreeze} disabled={isFreezing || verifiedCount === 0}>
              {isFreezing ? "Freezing..." : "Freeze Verified Rows"}
            </Button>
          </div>
        )}
      </div>

      {pendingCorrections.length > 0 && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {pendingCorrections.length} record(s) are missing a checkout and cannot be verified. Correct them in{" "}
          <Link href="/dashboard/attendance-management" className="font-semibold underline">
            Attendance Management
          </Link>{" "}
          (filter by date), then return here and re-run Verify.
          <button
            type="button"
            className="ml-2 text-xs font-semibold underline"
            onClick={() => setShowOnlyPending((v) => !v)}
          >
            {showOnlyPending ? "Show all rows" : "Show only pending corrections"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/95 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Employee</th>
              <th className="px-3 py-3">Godown</th>
              <th className="px-3 py-3">Check-In</th>
              <th className="px-3 py-3">Check-Out</th>
              <th className="px-3 py-3">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No attendance records in this cycle window.
                </td>
              </tr>
            ) : (
              visibleRows.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-slate-900">{formatDateLabel(record.attendanceDate)}</td>
                  <td className="px-3 py-3">{record.employeeName}</td>
                  <td className="px-3 py-3">{record.siteName}</td>
                  <td className="px-3 py-3">{record.checkInTime ?? "—"}</td>
                  <td className="px-3 py-3">{record.checkOutTime ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getVerificationBadgeClass(record)}`}>
                      {record.isPendingCorrection ? "Pending Correction" : record.salaryVerificationStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
