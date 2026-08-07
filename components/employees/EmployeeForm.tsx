"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Employee } from "@/types/employee";
import { Site } from "@/types/site";
import { employeeSchema, EmployeeFormData } from "@/schemas/employee.schema";

import { addEmployee, updateEmployee } from "@/services/employee.service";
import { subscribeSites } from "@/services/site.service";
import { resetEmployeeFaceEnrollment } from "@/app/dashboard/employees/faceActions";
import { uploadEmployeeIdProof } from "@/app/dashboard/employees/idProofActions";
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

const MAX_ID_PROOF_BYTES = 5 * 1024 * 1024; // 5mb; base64-encoded this stays under the 8mb server action body limit

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  employee?: Employee;
  onSuccess: (employeeId?: string, employeeName?: string) => void;
}

export default function EmployeeForm({ employee, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);

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
      salaryPerDay: employee?.salaryPerDay ?? 0,
      siteId: employee?.siteId || "",
    },
  });

  function handleIdProofChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after an error

    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("ID proof must be a PDF file");
      return;
    }
    if (file.size > MAX_ID_PROOF_BYTES) {
      toast.error("ID proof must be 5MB or smaller");
      return;
    }

    setIdProofFile(file);
  }

  async function onSubmit(data: EmployeeFormData) {
    try {
      setLoading(true);

      // A Drive hiccup (Apps Script cold start, network blip, timeout) must never block
      // saving the employee -- idProofUrl is optional at every layer (DB column is
      // nullable, schema has no required check), so on failure we keep whatever the
      // employee already had and let the admin re-attach it later via edit. Note: even a
      // *timed-out* upload can still have written the file to Drive server-side (Apps
      // Script responds only after finishing the write), so treating this as fatal used to
      // both lose the employee record and orphan an already-uploaded file.
      let idProofUrl = employee?.idProofUrl;
      if (idProofFile) {
        const base64Data = await readFileAsBase64(idProofFile);
        const uploadResult = await uploadEmployeeIdProof(idProofFile.name, idProofFile.type, base64Data);

        if ("error" in uploadResult) {
          toast.error(
            `Employee will be saved without the ID proof — upload failed: ${uploadResult.error}. You can attach it later by editing this employee.`
          );
        } else {
          idProofUrl = uploadResult.url;
        }
      }

      const payload: EmployeeFormData = { ...data, idProofUrl };

      try {
        if (employee?.id) {
          await updateEmployee(employee.id, payload);
          toast.success("Employee Updated Successfully");

          if (data.status === "Inactive" && employee.status !== "Inactive") {
            // Best-effort cleanup: don't let a face-service hiccup block the status update.
            resetEmployeeFaceEnrollment(employee.id).catch((error) => {
              console.error("Failed to clear face enrollment for deactivated employee", error);
            });
          }

          reset();
          setIdProofFile(null);
          onSuccess(employee.id, data.employeeName);
        } else {
          const created = await addEmployee(payload);
          toast.success("Employee Added Successfully");
          reset();
          setIdProofFile(null);
          onSuccess(created.id, created.employeeName);
        }
      } catch (error) {
        const supabaseError = error as { code?: string; details?: string; hint?: string };
        console.error("Failed to save employee", {
          error,
          code: supabaseError?.code,
          details: supabaseError?.details,
          hint: supabaseError?.hint,
        });
        toast.error(`Failed to save employee: ${error instanceof Error ? error.message : "Something went wrong"}`);
      }
    } catch (error) {
      // Reaching here means reading the picked file itself failed (e.g. a FileReader
      // error) -- uploadEmployeeIdProof never throws, it always resolves to a typed
      // { url } | { error } result, so this can't be an upload-service failure.
      console.error("Failed to read ID proof file", error);
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
          <Label>Salary per Day *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("salaryPerDay", { valueAsNumber: true })}
          />
          <p className="text-sm text-red-500">{errors.salaryPerDay?.message}</p>
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

      <div className="space-y-2">
        <Label>ID Proof (PDF)</Label>
        {employee?.idProofUrl && !idProofFile && (
          <p className="text-sm text-slate-600">
            <a href={employee.idProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
              View current ID proof
            </a>{" "}
            — choose a file below to replace it.
          </p>
        )}
        {idProofFile && <p className="text-sm text-slate-600">Selected: {idProofFile.name}</p>}
        <Input type="file" accept="application/pdf" onChange={handleIdProofChange} />
        <p className="text-xs text-slate-500">Optional. PDF only, up to 5MB.</p>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Saving..." : employee ? "Update Employee" : "Save Employee"}
        </Button>
      </div>
    </form>
  );
}
