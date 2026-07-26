"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppCard } from "@/components/ui/AppCard";
import MappingDialog from "@/components/mapping/MappingDialog";
import MappingTable from "@/components/mapping/MappingTable";
import DeleteMappingDialog from "@/components/mapping/DeleteMappingDialog";
import { Button } from "@/components/ui/button";
import { subscribeEmployees, getEmployees } from "@/services/employee.service";
import { subscribeSites, getSites } from "@/services/site.service";
import {
  deleteEmployeeSiteMappings,
  saveEmployeeSiteMappings,
  subscribeEmployeeSiteMappings,
  updateEmployeeSiteMappings,
} from "@/services/employeeSiteMapping.service";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { EmployeeSiteMapping, GroupedEmployeeSiteMapping } from "@/types/employeeSiteMapping";
import type { EmployeeSiteMappingFormValues } from "@/schemas/employeeSiteMapping.schema";

export default function EmployeeSiteMappingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [mappings, setMappings] = useState<EmployeeSiteMapping[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<GroupedEmployeeSiteMapping | undefined>();
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const employeeUnsub = subscribeEmployees((list) => setEmployees(list));
    const siteUnsub = subscribeSites((list) => setSites(list));
    const mappingUnsub = subscribeEmployeeSiteMappings((list) => setMappings(list));

    getEmployees().catch(() => undefined);
    getSites().catch(() => undefined);

    return () => {
      employeeUnsub();
      siteUnsub();
      mappingUnsub();
    };
  }, []);

  const groupedMappings = useMemo(() => {
    const groups = new Map<string, GroupedEmployeeSiteMapping>();

    mappings.forEach((mapping) => {
      const existing = groups.get(mapping.mappingGroupId);
      if (!existing) {
        groups.set(mapping.mappingGroupId, {
          mappingGroupId: mapping.mappingGroupId,
          siteId: mapping.siteId,
          siteCode: mapping.siteCode,
          siteName: mapping.siteName,
          clientName: mapping.clientName,
          fromDate: mapping.fromDate,
          toDate: mapping.toDate,
          status: mapping.status,
          employeeCount: 1,
          employees: [mapping],
        });
      } else {
        existing.employeeCount += 1;
        existing.employees.push(mapping);
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  }, [mappings]);

  async function handleSubmit(values: EmployeeSiteMappingFormValues) {
    try {
      setLoading(true);
      const site = sites.find((item) => item.id === values.siteId);

      if (!site) {
        toast.error("Please select a valid site.");
        return;
      }

      const selectedEmployees = employees.filter((employee) => values.employeeIds.includes(employee.id || ""));

      if (selectedMapping?.mappingGroupId) {
        const result = await updateEmployeeSiteMappings(selectedMapping.mappingGroupId, values, selectedEmployees, site);
        toast.success(
          `Employee Mapping Updated. ${result.assignedCount} employees assigned${result.skippedCount > 0 ? `, ${result.skippedCount} skipped due to overlap` : ""}.`
        );
      } else {
        const result = await saveEmployeeSiteMappings(values, selectedEmployees, site);
        toast.success(
          `Employee Mapping Saved. ${result.assignedCount} employees assigned${result.skippedCount > 0 ? `, ${result.skippedCount} skipped due to overlap` : ""}.`
        );
      }

      setDialogOpen(false);
      setSelectedMapping(undefined);
    } catch (error) {
      console.error(error);
      toast.error("Unable to save mapping.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!pendingDeleteGroupId) return;

    try {
      setDeleteLoading(true);
      await deleteEmployeeSiteMappings(pendingDeleteGroupId);
      toast.success("Employee Mapping Deleted");
      setDeleteDialogOpen(false);
      setPendingDeleteGroupId(undefined);
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete mapping.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Employee Site Mapping</h1>
          <p className="text-sm text-slate-500">Assign employees to sites for a date range; overlapping active assignments are blocked.</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            setSelectedMapping(undefined);
            setDialogOpen(true);
          }}
        >
          Add Mapping
        </Button>
      </div>

      <AppCard title="Site-based Assignment" description="Choose a site, date range, and assign active employees in bulk.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Active Sites</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{sites.filter((site) => site.status === "Active").length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Active Employees</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {employees.filter((employee) => employee.status === "Active").length}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Mappings</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{groupedMappings.length}</p>
          </div>
        </div>
      </AppCard>

      <AppCard title="Mapping List" description="Realtime employee-to-site assignments.">
        <MappingTable
          mappings={groupedMappings}
          onEdit={(mapping) => {
            setSelectedMapping(mapping);
            setDialogOpen(true);
          }}
          onDelete={(mapping) => {
            setPendingDeleteGroupId(mapping.mappingGroupId);
            setDeleteDialogOpen(true);
          }}
        />
      </AppCard>

      <MappingDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedMapping(undefined);
        }}
        mapping={selectedMapping}
        sites={sites.filter((site) => site.status === "Active")}
        employees={employees}
        loading={loading}
        onSubmit={handleSubmit}
      />

      <DeleteMappingDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} loading={deleteLoading} />
    </div>
  );
}
