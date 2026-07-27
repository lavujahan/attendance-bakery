"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Employee } from "@/types/employee";
import { Site } from "@/types/site";
import { employeeSchema, EmployeeFormData } from "@/schemas/employee.schema";

import { addEmployee, updateEmployee } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import { resetEmployeeFaceEnrollment } from "@/app/dashboard/employees/faceActions";
import { toast } from "sonner";

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

interface Props {
  employee?: Employee;
  onSuccess: (employeeId?: string, employeeName?: string) => void;
}

export default function EmployeeForm({ employee, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeSites((next) => setSites(next));
    return () => unsubscribe();
  }, []);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeName: employee?.employeeName || "",
      mobileNumber: employee?.mobileNumber || "",
      gender: employee?.gender || "Male",
      designation: employee?.designation || "",
      joiningDate: employee?.joiningDate || "",
      dailyStartTime: employee?.dailyStartTime?.slice(0, 5) || "09:00",
      dailyEndTime: employee?.dailyEndTime?.slice(0, 5) || "18:00",
      status: employee?.status || "Active",
      salaryPerHour: employee?.salaryPerHour ?? 0,
      siteId: employee?.siteId || "",
    },
  });

  async function onSubmit(data: EmployeeFormData) {
    try {
      setLoading(true);

      if (employee?.id) {
        await updateEmployee(employee.id, data);
        toast.success("Employee Updated Successfully");

        if (data.status === "Inactive" && employee.status !== "Inactive") {
          // Best-effort cleanup: don't let a face-service hiccup block the status update.
          resetEmployeeFaceEnrollment(employee.id).catch((error) => {
            console.error("Failed to clear face enrollment for deactivated employee", error);
          });
        }

        reset();
        onSuccess(employee.id, data.employeeName);
      } else {
        const created = await addEmployee(data);
        toast.success("Employee Added Successfully");
        reset();
        onSuccess(created.id, created.employeeName);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Employee Name *</Label>
          <Input placeholder="Enter Employee Name" {...register("employeeName")} />
          <p className="text-sm text-red-500">{errors.employeeName?.message}</p>
        </div>

        <div className="space-y-2">
          <Label>Mobile Number *</Label>
          <Input maxLength={10} placeholder="9876543210" {...register("mobileNumber")} />
          <p className="text-sm text-red-500">{errors.mobileNumber?.message}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Salary per Hour *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("salaryPerHour", { valueAsNumber: true })}
          />
          <p className="text-sm text-red-500">{errors.salaryPerHour?.message}</p>
        </div>

        <div className="space-y-2">
          <Label>Gender</Label>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Designation *</Label>
          <Input placeholder="Site Engineer" {...register("designation")} />
          <p className="text-sm text-red-500">{errors.designation?.message}</p>
        </div>

        <div className="space-y-2">
          <Label>Joining Date</Label>
          <Input type="date" {...register("joiningDate")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Daily Mandatory Start Time *</Label>
          <Input type="time" {...register("dailyStartTime")} />
          <p className="text-xs text-slate-500">Check-ins after this time are marked Late for this employee.</p>
          <p className="text-sm text-red-500">{errors.dailyStartTime?.message}</p>
        </div>

        <div className="space-y-2">
          <Label>Daily Mandatory End Time *</Label>
          <Input type="time" {...register("dailyEndTime")} />
          <p className="text-xs text-slate-500">Checking out before this time marks this employee an Early Leaver for the day.</p>
          <p className="text-sm text-red-500">{errors.dailyEndTime?.message}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Godown *</Label>
          <Controller
            control={control}
            name="siteId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a godown">
                    {(value: string) => sites.find((site) => site.id === value)?.siteName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sites
                    .filter((site) => site.status === "Active")
                    .map((site) => (
                      <SelectItem key={site.id} value={site.id!}>
                        {site.siteName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-sm text-red-500">{errors.siteId?.message}</p>
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
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Saving..." : employee ? "Update Employee" : "Save Employee"}
        </Button>
      </div>
    </form>
  );
}
