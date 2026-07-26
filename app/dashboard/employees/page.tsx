import EmployeeDialog from "@/components/employees/EmployeeDialog";
import EmployeeTable from "@/components/employees/EmployeeTable";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">Employee roster, and face enrollment for kiosk check-in/out.</p>
        </div>
        <EmployeeDialog />
      </div>

      <EmployeeTable />
    </div>
  );
}
