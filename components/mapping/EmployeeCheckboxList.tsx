"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@/types/employee";

interface Props {
  employees: Employee[];
  selectedIds: string[];
  onToggle: (employeeId: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  selectedCount: number;
}

export default function EmployeeCheckboxList({
  employees,
  selectedIds,
  onToggle,
  searchTerm,
  onSearchChange,
  onSelectAll,
  onClearSelection,
  selectedCount,
}: Props) {
  const filteredEmployees = employees.filter((employee) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    return [employee.employeeCode, employee.employeeName, employee.mobileNumber, employee.designation]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label className="text-sm font-semibold">Employee Search</Label>
          <p className="text-sm text-slate-500">Search by employee code, name, mobile, or designation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      </div>

      <Input placeholder="Search employees" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} />

      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
        <span>{selectedCount} selected</span>
        <span>{filteredEmployees.length} employees</span>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
        {filteredEmployees.length === 0 ? (
          <p className="px-2 py-4 text-sm text-slate-500">No employees found.</p>
        ) : (
          filteredEmployees.map((employee) => {
            const checked = selectedIds.includes(employee.id || "");

            return (
              <label
                key={employee.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(employee.id || "")}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {employee.employeeCode} • {employee.employeeName}
                  </p>
                  <p className="text-sm text-slate-500">{employee.designation}</p>
                  <p className="text-sm text-slate-500">{employee.mobileNumber}</p>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
