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
import GPSLocationPicker from "./GPSLocationPicker";

interface Props {
  site?: Site;
  onSuccess: () => void;
}

export default function SiteForm({ site, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [gpsValue, setGpsValue] = useState<{ latitude: number | null; longitude: number | null; accuracy: number | null }>({
    latitude: site?.latitude ?? null,
    longitude: site?.longitude ?? null,
    accuracy: null,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema) as Resolver<SiteFormData>,
    defaultValues: {
      siteName: site?.siteName || "",
      clientName: site?.clientName || "",
      siteIncharge: site?.siteIncharge || "",
      latitude: site?.latitude ?? 0,
      longitude: site?.longitude ?? 0,
      allowedRadius: site?.allowedRadius ?? 250,
      geofenceEnabled: site?.geofenceEnabled ?? true,
      status: site?.status || "Active",
    },
  });

  const geofenceEnabled = watch("geofenceEnabled");

  async function onSubmit(data: SiteFormData) {
    try {
      setLoading(true);

      if (gpsValue.latitude === null || gpsValue.longitude === null) {
        toast.error("Location is required to create a site.");
        return;
      }

      const payload: SiteFormData = { ...data, latitude: gpsValue.latitude, longitude: gpsValue.longitude };

      if (site?.id) {
        await updateSite(site.id, payload);
        toast.success("Site Updated Successfully");
      } else {
        await addSite(payload);
        toast.success("Site Added Successfully");
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
          <Label>Site Name *</Label>
          <Input placeholder="Enter site name" {...register("siteName")} />
          {errors.siteName && <p className="text-sm text-red-500">{errors.siteName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Client Name *</Label>
          <Input placeholder="Enter client name" {...register("clientName")} />
          {errors.clientName && <p className="text-sm text-red-500">{errors.clientName.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Site Incharge *</Label>
        <Input placeholder="Enter site incharge" {...register("siteIncharge")} />
        {errors.siteIncharge && <p className="text-sm text-red-500">{errors.siteIncharge.message}</p>}
      </div>

      <GPSLocationPicker value={gpsValue} onChange={setGpsValue} />

      {errors.latitude && <p className="text-sm text-red-500">{errors.latitude.message}</p>}
      {errors.longitude && <p className="text-sm text-red-500">{errors.longitude.message}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Allowed Radius (Meters) *</Label>
          <Input
            type="number"
            step="1"
            placeholder="250"
            disabled={!geofenceEnabled}
            {...register("allowedRadius", { valueAsNumber: true })}
          />
          {errors.allowedRadius && <p className="text-sm text-red-500">{errors.allowedRadius.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>GPS Geofence Check *</Label>
          <Controller
            control={control}
            name="geofenceEnabled"
            render={({ field }) => (
              <Select value={field.value ? "enabled" : "disabled"} onValueChange={(value) => field.onChange(value === "enabled")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-slate-500">When disabled, GPS location is not checked at check-in/check-out for this site.</p>
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
          {loading ? "Saving..." : site ? "Update Site" : "Save Site"}
        </Button>
      </div>
    </form>
  );
}
