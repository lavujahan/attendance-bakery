"use client";

import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiEdit2, FiTrash2, FiSearch } from "react-icons/fi";
import { deleteEmployee, exportEmployeesPDF, subscribeEmployees } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import { Employee } from "@/types/employee";
import { Site } from "@/types/site";
import { toast } from "sonner";
import EmployeeDialog from "./EmployeeDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function EmployeeTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeEmployees((data) => {
      setEmployees((data as Employee[]) || []);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSites((data) => setSites(data));
    return () => unsubscribe();
  }, []);

  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach((site) => site.id && map.set(site.id, site));
    return map;
  }, [sites]);

  const filteredEmployees = useMemo(() => {
    const value = search.toLowerCase().trim();

    return employees.filter(
      (emp) =>
        emp.employeeCode?.toLowerCase().includes(value) ||
        emp.employeeName?.toLowerCase().includes(value) ||
        emp.mobileNumber?.includes(value)
    );
  }, [employees, search]);

  const handleDelete = async () => {
    if (!selectedEmployee?.id) return;

    try {
      setDeleting(true);
      // face_embeddings.employee_id has ON DELETE CASCADE (0001_init.sql), so deleting
      // the employee row already cleans up their enrolled face data.
      await deleteEmployee(selectedEmployee.id);
      setDeleteOpen(false);
      setSelectedEmployee(null);
      toast.success("Employee Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border bg-white p-6">Loading employees...</div>;
  }

  const faceBadge = (employee: Employee) =>
    employee.faceEnrolled ? (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
        Face enrolled
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-amber-50 text-amber-700">
        Not enrolled
      </Badge>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => exportEmployeesPDF(filteredEmployees, sites)}
        >
          <FiDownload className="mr-2" /> Download PDF
        </Button>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {filteredEmployees.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-gray-500">
            No employees found.
          </div>
        ) : (
          filteredEmployees.map((employee) => (
            <div key={employee.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{employee.employeeName}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    employee.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {employee.status}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>Serial No: {employee.serialNo}</p>
                <p>{employee.mobileNumber}</p>
                <p>{employee.designation}</p>
                <p>Salary/hr: {employee.salaryPerHour.toFixed(2)}</p>
                <p>Godown: {(employee.siteId && siteMap.get(employee.siteId)?.siteName) || "—"}</p>
                <p>Start time: {employee.dailyStartTime?.slice(0, 5)}</p>
                <p>End time: {employee.dailyEndTime?.slice(0, 5)}</p>
              </div>
              <div className="mt-3">{faceBadge(employee)}</div>
              <div className="mt-4 flex gap-2">
                <EmployeeDialog
                  employee={employee}
                  trigger={
                    <button type="button" className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium">
                      Edit
                    </button>
                  }
                />
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-600"
                  onClick={() => {
                    setSelectedEmployee(employee);
                    setDeleteOpen(true);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Serial No</th>
              <th className="p-3 text-left">Employee Name</th>
              <th className="p-3 text-left">Mobile</th>
              <th className="p-3 text-left">Designation</th>
              <th className="p-3 text-left">Salary/hr</th>
              <th className="p-3 text-left">Godown</th>
              <th className="p-3 text-left">Start Time</th>
              <th className="p-3 text-left">End Time</th>
              <th className="p-3 text-center">Face</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-gray-500">
                  No employees found.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{employee.serialNo}</td>
                  <td className="p-3 font-medium text-slate-900">{employee.employeeName}</td>
                  <td className="p-3">{employee.mobileNumber}</td>
                  <td className="p-3">{employee.designation}</td>
                  <td className="p-3">{employee.salaryPerHour.toFixed(2)}</td>
                  <td className="p-3">{(employee.siteId && siteMap.get(employee.siteId)?.siteName) || "—"}</td>
                  <td className="p-3">{employee.dailyStartTime?.slice(0, 5)}</td>
                  <td className="p-3">{employee.dailyEndTime?.slice(0, 5)}</td>
                  <td className="p-3 text-center">{faceBadge(employee)}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        employee.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {employee.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <EmployeeDialog
                        employee={employee}
                        trigger={
                          <button type="button" className="rounded-lg p-2 hover:bg-blue-100" title="Edit">
                            <FiEdit2 />
                          </button>
                        }
                      />
                      <button
                        type="button"
                        className="rounded-lg p-2 hover:bg-red-100"
                        title="Delete"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setDeleteOpen(true);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">Are you sure you want to delete this employee?</p>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
