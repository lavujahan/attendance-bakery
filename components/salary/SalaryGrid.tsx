"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { getCurrentAdminId } from "@/lib/currentAdmin";
import { minutesToHoursLabel } from "@/lib/payrollMath";
import { generateSalarySlipPDF } from "@/services/salarySlip.service";
import { markSalaryRecordPaid } from "@/services/salaryRecord.service";
import type { SalaryCycle, SalaryRecord } from "@/types/salary";
import OverrideModal from "./OverrideModal";

function getStatusBadgeClass(status: SalaryRecord["recordStatus"]) {
  switch (status) {
    case "Finalized":
      return "bg-amber-50 text-amber-700";
    case "Paid":
      return "bg-emerald-50 text-emerald-700";
    case "Draft":
    default:
      return "bg-slate-100 text-slate-600";
  }
}

interface SalaryGridProps {
  cycle: SalaryCycle;
  records: SalaryRecord[];
  canRecompute: boolean;
  onRecompute: () => Promise<void>;
  onChanged: () => void;
}

export default function SalaryGrid({ cycle, records, canRecompute, onRecompute, onChanged }: SalaryGridProps) {
  const [overrideTarget, setOverrideTarget] = useState<SalaryRecord | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      await onRecompute();
      toast.success("Salary preview recomputed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to recompute salary preview.");
    } finally {
      setIsRecomputing(false);
    }
  };

  const handleMarkPaid = async (record: SalaryRecord) => {
    if (!record.id) return;
    setPayingId(record.id);
    try {
      const adminId = await getCurrentAdminId();
      await markSalaryRecordPaid(record.id, adminId);
      toast.success(`${record.employeeName} marked Paid`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark record as paid.");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <AppCard title="Salary Grid" description="One row per employee for this cycle, computed from Frozen attendance.">
      {canRecompute && (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleRecompute} disabled={isRecomputing}>
            {isRecomputing ? "Recomputing..." : "Recompute Preview"}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/95 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-3 py-3">Employee</th>
              <th className="px-3 py-3">Godown</th>
              <th className="px-3 py-3">Worked</th>
              <th className="px-3 py-3">Payable</th>
              <th className="px-3 py-3">Rate</th>
              <th className="px-3 py-3">Gross</th>
              <th className="px-3 py-3">Override</th>
              <th className="px-3 py-3">Final</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {records.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">
                  No salary records yet. Freeze attendance for this cycle, then recompute the preview.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{record.employeeName}</p>
                    <p className="text-xs text-slate-500">{record.employeeCode}</p>
                  </td>
                  <td className="px-3 py-3">{record.siteName}</td>
                  <td className="px-3 py-3">{minutesToHoursLabel(record.workedMinutes)}</td>
                  <td className="px-3 py-3">{minutesToHoursLabel(record.payableMinutes)}</td>
                  <td className="px-3 py-3">{record.hourlyRate.toFixed(2)}</td>
                  <td className="px-3 py-3">{record.grossSalaryAmount.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    {record.overridePayableMinutes !== undefined ? (
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {minutesToHoursLabel(record.overridePayableMinutes)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{record.finalSalaryAmount.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(record.recordStatus)}`}>
                      {record.recordStatus}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {record.recordStatus === "Draft" && (
                        <Button variant="outline" size="sm" onClick={() => setOverrideTarget(record)}>
                          Override
                        </Button>
                      )}
                      {(record.recordStatus === "Finalized" || record.recordStatus === "Paid") && (
                        <Button variant="outline" size="sm" onClick={() => generateSalarySlipPDF(record, cycle)}>
                          Slip
                        </Button>
                      )}
                      {record.recordStatus === "Finalized" && (
                        <Button size="sm" onClick={() => handleMarkPaid(record)} disabled={payingId === record.id}>
                          {payingId === record.id ? "Marking..." : "Mark Paid"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {overrideTarget && (
        <OverrideModal
          key={overrideTarget.id}
          record={overrideTarget}
          onOpenChange={(open) => !open && setOverrideTarget(null)}
          onApplied={onChanged}
        />
      )}
    </AppCard>
  );
}
