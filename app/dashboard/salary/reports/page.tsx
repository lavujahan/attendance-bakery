import SalaryReportsWorkspace from "@/components/salary/SalaryReportsWorkspace";

export default function SalaryReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Salary Reports</h1>
        <p className="text-sm text-slate-500">
          Employee, godown, summary, and attendance-exception reports for a chosen salary cycle.
        </p>
      </div>

      <SalaryReportsWorkspace />
    </div>
  );
}
