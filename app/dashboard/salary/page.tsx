import Link from "next/link";
import { Button } from "@/components/ui/button";
import SalaryCyclesWorkspace from "@/components/salary/SalaryCyclesWorkspace";

export default function SalaryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Salary</h1>
          <p className="text-sm text-slate-500">
            Create salary cycles, verify and freeze attendance, finalize payroll, and generate salary slips and reports.
          </p>
        </div>
        <Link href="/dashboard/salary/reports">
          <Button variant="outline">View Salary Reports</Button>
        </Link>
      </div>

      <SalaryCyclesWorkspace />
    </div>
  );
}
