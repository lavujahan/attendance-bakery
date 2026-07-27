"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
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
import { addSite, updateSite } from "@/services/site.service";
import { siteSchema, SiteFormData } from "@/schemas/site.schema";
import { Site } from "@/types/site";

interface Props {
  site?: Site;
  onSuccess: () => void;
}

export default function SiteForm({ site, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema) as Resolver<SiteFormData>,
    defaultValues: {
      siteName: site?.siteName || "",
      siteIncharge: site?.siteIncharge || "",
      latitude: 0,
      longitude: 0,
      allowedRadius: 250,
      geofenceEnabled: false,
      status: site?.status || "Active",
    },
  });

  async function onSubmit(data: SiteFormData) {
    try {
      setLoading(true);

      const payload: SiteFormData = { ...data, latitude: 0, longitude: 0, allowedRadius: 250, geofenceEnabled: false };

      if (site?.id) {
        await updateSite(site.id, payload);
        toast.success("Godown Updated Successfully");
      } else {
        await addSite(payload);
        toast.success("Godown Added Successfully");
      }

      reset();
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Godown Name *</Label>
          <Input placeholder="Enter godown name" {...register("siteName")} />
          {errors.siteName && <p className="text-sm text-red-500">{errors.siteName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Godown Incharge *</Label>
          <Input placeholder="Enter godown incharge" {...register("siteIncharge")} />
          {errors.siteIncharge && <p className="text-sm text-red-500">{errors.siteIncharge.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          {loading ? "Saving..." : site ? "Update Godown" : "Save Godown"}
        </Button>
      </div>
    </form>
  );
}
