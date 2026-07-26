"use client";

import { useState } from "react";
import { Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import EmployeeForm from "./EmployeeForm";
import FaceEnrollDialog from "./FaceEnrollDialog";

interface EmployeeDialogProps {
  employee?: Employee;
  trigger?: React.ReactElement;
}

export default function EmployeeDialog({ employee, trigger }: EmployeeDialogProps) {
  const [open, setOpen] = useState(false);
  const [faceEnroll, setFaceEnroll] = useState<{ id: string; name: string } | null>(null);

  const isEditing = Boolean(employee);

  const handleFormSuccess = (employeeId?: string, employeeName?: string) => {
    setOpen(false);
    // New employees go straight into face enrollment; editing an existing employee
    // doesn't force re-enrollment (use the "Enroll Face" button below for that).
    if (!isEditing && employeeId) {
      setFaceEnroll({ id: employeeId, name: employeeName ?? "New Employee" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger ?? <Button type="button">Add Employee</Button>} />

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>

          <EmployeeForm employee={employee} onSuccess={handleFormSuccess} />

          {isEditing && employee?.id ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setFaceEnroll({ id: employee.id!, name: employee.employeeName })}
            >
              {employee.faceEnrolled ? "Re-enroll Face" : "Enroll Face"}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      {faceEnroll ? (
        <FaceEnrollDialog
          employeeId={faceEnroll.id}
          employeeName={faceEnroll.name}
          open={Boolean(faceEnroll)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setFaceEnroll(null);
          }}
        />
      ) : null}
    </>
  );
}
