"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reopenCycleSchema } from "@/schemas/reopenCycle.schema";

interface ReopenCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}

// The explicit, audited, Admin-only unlock action -- a reason is required and logged to
// salary_cycle_audit_log by the reopen_salary_cycle RPC.
export default function ReopenCycleDialog({ open, onOpenChange, onConfirm }: ReopenCycleDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    const parsed = reopenCycleSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "A reason is required");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(parsed.data.reason);
      setReason("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reopen salary cycle.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen Salary Cycle</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Reopening resets this cycle&apos;s attendance back to Draft and its salary records back to Draft. A full
          re-verify and re-freeze pass is required before finalizing again.
        </p>
        <label className="space-y-1 text-sm text-slate-600">
          <span className="font-medium">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            placeholder="Why is this cycle being reopened?"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Reopening..." : "Reopen Cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
