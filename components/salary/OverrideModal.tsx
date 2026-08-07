"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentAdminId } from "@/lib/currentAdmin";
import { minutesToDecimalHours } from "@/lib/payrollMath";
import { salaryOverrideSchema } from "@/schemas/salaryOverride.schema";
import { applyPayableOverride, clearPayableOverride } from "@/services/salaryRecord.service";
import type { OverrideReasonCategory, SalaryRecord } from "@/types/salary";

const reasonOptions: OverrideReasonCategory[] = [
  "Rain",
  "Power Failure",
  "Festival",
  "Management Decision",
  "Emergency",
  "Other",
];

interface OverrideModalProps {
  record: SalaryRecord;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}

// The caller mounts this with `key={record.id}` (see SalaryGrid), so a new record always
// gets a fresh instance -- local state is seeded once from props via useState's lazy
// initializer instead of an effect that re-syncs state on every prop change.
export default function OverrideModal({ record, onOpenChange, onApplied }: OverrideModalProps) {
  const [hours, setHours] = useState(() =>
    record.overridePayableMinutes !== undefined
      ? String(minutesToDecimalHours(record.overridePayableMinutes))
      : String(minutesToDecimalHours(record.payableMinutes))
  );
  const [reason, setReason] = useState<OverrideReasonCategory>(record.overrideReasonCategory ?? "Rain");
  const [note, setNote] = useState(record.overrideNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasExistingOverride = record.overridePayableMinutes !== undefined;

  const handleApply = async () => {
    const parsed = salaryOverrideSchema.safeParse({
      overridePayableHours: Number(hours),
      overrideReasonCategory: reason,
      overrideNote: note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid override");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const adminId = await getCurrentAdminId();
      await applyPayableOverride(
        record.id!,
        {
          overridePayableMinutes: Math.round(parsed.data.overridePayableHours * 60),
          overrideReasonCategory: parsed.data.overrideReasonCategory,
          overrideNote: parsed.data.overrideNote,
        },
        adminId
      );
      toast.success("Override applied");
      onApplied();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to apply override.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await clearPayableOverride(record.id!);
      toast.success("Override cleared");
      onApplied();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to clear override.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Payable Hours — {record.employeeName}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-600">
          System-computed payable hours: <span className="font-semibold">{minutesToDecimalHours(record.payableMinutes)}h</span>.
          Use this to account for a godown closing early (rain, power failure, festival, management decision, or an
          emergency).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Override Payable Hours</span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as OverrideReasonCategory)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            >
              {reasonOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
            <span className="font-medium">Note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
              placeholder="Brief note for the audit trail"
            />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}

        <DialogFooter>
          {hasExistingOverride && (
            <Button variant="outline" onClick={handleClear} disabled={isSaving}>
              Clear Override
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={isSaving}>
            {isSaving ? "Saving..." : "Apply Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
