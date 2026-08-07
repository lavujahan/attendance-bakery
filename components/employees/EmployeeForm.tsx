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

// The upload runs when the admin picks the file, not on submit: Apps Script writes the
// file to Drive and only *then* responds, so a client-side abort (45s timeout, stale
// deployment URL) used to leave the file in Drive while the employee saved with a null
// id_proof_url -- an orphan with no way to recover the link. Resolving the URL before
// submit means a slow Drive call can no longer cost us the link, and the admin sees the
// failure in time to retry instead of discovering it later in the table.
type IdProofUpload =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  // `shared: false` means the file uploaded but Drive refused to make it
  // link-viewable -- still a success, so the URL is kept and saved.
  | { status: "done"; fileName: string; shared: boolean }
  | { status: "error"; fileName: string; error: string };

export default function EmployeeForm({ employee, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [idProofUrl, setIdProofUrl] = useState(employee?.idProofUrl);
  const [idProofUpload, setIdProofUpload] = useState<IdProofUpload>({ status: "idle" });
  // Kept only so "Retry upload" can re-send without making the admin re-pick the file.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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

  async function uploadIdProofFile(file: File) {
    setPendingFile(file);
    setIdProofUpload({ status: "uploading", fileName: file.name });

    try {
      const base64Data = await readFileAsBase64(file);
      const result = await uploadEmployeeIdProof(file.name, file.type, base64Data);

      if ("error" in result) {
        setIdProofUpload({ status: "error", fileName: file.name, error: result.error });
        return;
      }

      setIdProofUrl(result.url);
      setIdProofUpload({ status: "done", fileName: file.name, shared: result.shared });
    } catch (error) {
      // uploadEmployeeIdProof never throws (it resolves to a typed { url } | { error }),
      // so reaching here means readFileAsBase64 rejected -- i.e. a FileReader error.
      setIdProofUpload({
        status: "error",
        fileName: file.name,
        error: error instanceof Error ? error.message : "could not read the selected file",
      });
    }
  }

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

    void uploadIdProofFile(file);
  }

  function retryIdProofUpload() {
    if (pendingFile) void uploadIdProofFile(pendingFile);
  }

  function resetIdProofUpload() {
    setIdProofUpload({ status: "idle" });
    setPendingFile(null);
  }

  async function onSubmit(data: EmployeeFormData) {
    try {
      setLoading(true);

      // idProofUrl is already resolved by uploadIdProofFile (or still holds whatever the
      // employee had). It stays optional at every layer -- nullable DB column, no required
      // check in the schema -- so a failed upload saves the employee without it rather
      // than blocking the record.
      const payload: EmployeeFormData = { ...data, idProofUrl };

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
        resetIdProofUpload();
        onSuccess(employee.id, data.employeeName);
      } else {
        const created = await addEmployee(payload);
        toast.success("Employee Added Successfully");
        reset();
        setIdProofUrl(undefined);
        resetIdProofUpload();
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

        {idProofUpload.status === "idle" && idProofUrl && (
          <p className="text-sm text-slate-600">
            <a href={idProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
              View current ID proof
            </a>{" "}
            — choose a file below to replace it.
          </p>
        )}

        {idProofUpload.status === "uploading" && (
          <p className="text-sm text-slate-600">
            Uploading {idProofUpload.fileName} to Drive… this can take up to 45 seconds on a cold start.
          </p>
        )}

        {idProofUpload.status === "done" && idProofUrl && (
          <div className="space-y-1">
            <p className="text-sm text-emerald-700">
              Uploaded {idProofUpload.fileName} —{" "}
              <a href={idProofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                View
              </a>
            </p>
            {!idProofUpload.shared && (
              <p className="text-xs text-amber-700">
                Drive would not set link sharing on this file, so only people who can already access the
                ID proof folder will be able to open it. The link is saved either way.
              </p>
            )}
          </div>
        )}

        {idProofUpload.status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-red-600">Upload failed: {idProofUpload.error}</p>
            <Button type="button" variant="outline" size="sm" onClick={retryIdProofUpload}>
              Retry upload
            </Button>
            <p className="text-xs text-slate-500">
              You can still save without the ID proof and attach it later by editing this employee.
            </p>
          </div>
        )}

        <Input
          type="file"
          accept="application/pdf"
          onChange={handleIdProofChange}
          disabled={idProofUpload.status === "uploading"}
        />
        <p className="text-xs text-slate-500">Optional. PDF only, up to 5MB.</p>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {/* Blocked while uploading so a save can't race an in-flight upload and store a
            stale null. On failure the button stays enabled -- saving without the ID proof
            is a deliberate choice the admin can see, not a silent fallback. */}
        <Button
          type="submit"
          disabled={loading || idProofUpload.status === "uploading"}
          className="w-full sm:w-auto"
        >
          {loading ? "Saving..." : employee ? "Update Employee" : "Save Employee"}
        </Button>
      </div>
    </form>
  );
}
