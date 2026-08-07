"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentAdminId } from "@/lib/currentAdmin";
import {
  createSalaryCycle,
  deleteSalaryCycle,
  reopenSalaryCycle,
  subscribeSalaryCycles,
  suggestNextSalaryCycle,
} from "@/services/salaryCycle.service";
import { getSalaryRecordTotalsByCycle } from "@/services/salaryRecord.service";
import { salaryCycleSchema } from "@/schemas/salaryCycle.schema";
import type { SalaryCycle } from "@/types/salary";
import ReopenCycleDialog from "./ReopenCycleDialog";

function formatDateLabel(value: string) {
  if (!value) return "—";
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

export default function SalaryCyclesWorkspace() {
  const [cycles, setCycles] = useState<SalaryCycle[]>([]);
  const [totals, setTotals] = useState<Map<string, { employeeCount: number; totalFinalSalary: number }>>(new Map());
  const [createOpen, setCreateOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalaryCycle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<SalaryCycle | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSalaryCycles(setCycles);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    getSalaryRecordTotalsByCycle()
      .then(setTotals)
      .catch(() => setTotals(new Map()));
  }, [cycles]);

  const sortedCycles = useMemo(
    () => [...cycles].sort((a, b) => b.fromDate.localeCompare(a.fromDate)),
    [cycles]
  );

  const openCreateDialog = async () => {
    setFormError(null);
    try {
      const suggestion = await suggestNextSalaryCycle();
      setFromDate(suggestion?.fromDate ?? "");
      setToDate(suggestion?.toDate ?? "");
    } catch {
      setFromDate("");
      setToDate("");
    }
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const parsed = salaryCycleSchema.safeParse({ fromDate, toDate });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid dates");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await createSalaryCycle(parsed.data);
      toast.success("Salary cycle created");
      setCreateOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to create salary cycle.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      await deleteSalaryCycle(deleteTarget.id);
      toast.success("Salary cycle deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete salary cycle.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReopen = async (reason: string) => {
    if (!reopenTarget?.id) return;
    const adminId = await getCurrentAdminId();
    await reopenSalaryCycle(reopenTarget.id, adminId, reason);
    toast.success("Salary cycle reopened");
    setReopenTarget(null);
  };

  return (
    <AppCard title="Salary Cycles" description="Every cycle ever created — full history is retained.">
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreateDialog}>New Cycle</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/95 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-3 py-3">From</th>
              <th className="px-3 py-3">To</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Employees</th>
              <th className="px-3 py-3">Total Salary</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedCycles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No salary cycles yet. Create the first one to get started.
                </td>
              </tr>
            ) : (
              sortedCycles.map((cycle) => {
                const total = cycle.id ? totals.get(cycle.id) : undefined;
                return (
                  <tr key={cycle.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-900">{formatDateLabel(cycle.fromDate)}</td>
                    <td className="px-3 py-3">{formatDateLabel(cycle.toDate)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(cycle.status)}`}>
                        {cycle.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{total?.employeeCount ?? 0}</td>
                    <td className="px-3 py-3">{(total?.totalFinalSalary ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/salary/${cycle.id}`}>
                          <Button variant="outline" size="sm">
                            Open
                          </Button>
                        </Link>
                        {(cycle.status === "Finalized" || cycle.status === "Paid") && (
                          <Button variant="outline" size="sm" onClick={() => setReopenTarget(cycle)}>
                            Reopen
                          </Button>
                        )}
                        {cycle.status === "Draft" && (
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(cycle)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Salary Cycle</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">From Date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">To Date</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
            </label>
          </div>
          {formError && <p className="text-sm text-rose-600">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Salary Cycle</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This removes the {deleteTarget ? formatDateLabel(deleteTarget.fromDate) : ""} –{" "}
            {deleteTarget ? formatDateLabel(deleteTarget.toDate) : ""} draft cycle and any preview salary records in it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReopenCycleDialog
        open={Boolean(reopenTarget)}
        onOpenChange={(open) => !open && setReopenTarget(null)}
        onConfirm={handleReopen}
      />
    </AppCard>
  );
}
