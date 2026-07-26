"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MappingForm from "./MappingForm";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { GroupedEmployeeSiteMapping } from "@/types/employeeSiteMapping";
import type { EmployeeSiteMappingFormValues } from "@/schemas/employeeSiteMapping.schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping?: GroupedEmployeeSiteMapping;
  sites: Site[];
  employees: Employee[];
  loading?: boolean;
  onSubmit: (values: EmployeeSiteMappingFormValues) => Promise<void>;
}

export default function MappingDialog({ open, onOpenChange, mapping, sites, employees, loading = false, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mapping ? "Edit Employee Mapping" : "Create Employee Mapping"}</DialogTitle>
          <DialogDescription>
            Assign one or more active employees to a site for a selected date range.
          </DialogDescription>
        </DialogHeader>
        <MappingForm
          mapping={mapping}
          sites={sites}
          employees={employees}
          loading={loading}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
