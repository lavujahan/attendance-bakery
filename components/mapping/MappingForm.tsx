"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { employeeSiteMappingSchema, EmployeeSiteMappingFormValues } from "@/schemas/employeeSiteMapping.schema";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { GroupedEmployeeSiteMapping } from "@/types/employeeSiteMapping";
import EmployeeCheckboxList from "./EmployeeCheckboxList";

interface Props {
  mapping?: GroupedEmployeeSiteMapping;
  sites: Site[];
  employees: Employee[];
  loading?: boolean;
  onSubmit: (values: EmployeeSiteMappingFormValues) => Promise<void>;
  onCancel: () => void;
}

export default function MappingForm({ mapping, sites, employees, loading = false, onSubmit, onCancel }: Props) {
  const [employeeSearch, setEmployeeSearch] = useState("");

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EmployeeSiteMappingFormValues>({
    resolver: zodResolver(employeeSiteMappingSchema) as Resolver<EmployeeSiteMappingFormValues>,
    defaultValues: {
      siteId: mapping?.siteId || "",
      fromDate: mapping?.fromDate || "",
      toDate: mapping?.toDate || "",
      employeeIds: mapping?.employees.map((employee) => employee.employeeId) || [],
      status: mapping?.status || "Active",
    },
  });

  const selectedEmployeeIds = watch("employeeIds") || [];

  useEffect(() => {
    reset({
      siteId: mapping?.siteId || "",
      fromDate: mapping?.fromDate || "",
      toDate: mapping?.toDate || "",
      employeeIds: mapping?.employees.map((employee) => employee.employeeId) || [],
      status: mapping?.status || "Active",
    });
  }, [mapping, reset]);

  const toggleEmployee = (employeeId: string) => {
    const next = selectedEmployeeIds.includes(employeeId)
      ? selectedEmployeeIds.filter((id) => id !== employeeId)
      : [...selectedEmployeeIds, employeeId];
    setValue("employeeIds", next, { shouldValidate: true });
  };

  const selectAllEmployees = () => {
    const activeEmployeeIds = employees
      .filter((employee) => employee.status === "Active")
      .map((employee) => employee.id || "")
      .filter(Boolean);
    setValue("employeeIds", activeEmployeeIds, { shouldValidate: true });
  };

  const clearSelection = () => setValue("employeeIds", [], { shouldValidate: true });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Site *</Label>
          <select
            value={watch("siteId")}
            onChange={(event) => setValue("siteId", event.target.value, { shouldValidate: true })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">Select site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.siteCode} - {site.siteName} ({site.clientName})
              </option>
            ))}
          </select>
          {errors.siteId && <p className="text-sm text-red-500">{errors.siteId.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>From Date *</Label>
            <Input type="date" {...register("fromDate")} />
            {errors.fromDate && <p className="text-sm text-red-500">{errors.fromDate.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>To Date *</Label>
            <Input type="date" {...register("toDate")} />
            {errors.toDate && <p className="text-sm text-red-500">{errors.toDate.message}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <EmployeeCheckboxList
        employees={employees.filter((employee) => employee.status === "Active")}
        selectedIds={selectedEmployeeIds}
        onToggle={toggleEmployee}
        searchTerm={employeeSearch}
        onSearchChange={setEmployeeSearch}
        onSelectAll={selectAllEmployees}
        onClearSelection={clearSelection}
        selectedCount={selectedEmployeeIds.length}
      />

      {errors.employeeIds && <p className="text-sm text-red-500">{errors.employeeIds.message}</p>}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Saving..." : mapping ? "Update Mapping" : "Save Mapping"}
        </Button>
      </div>
    </form>
  );
}
