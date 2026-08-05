"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
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
import { addHoliday, addHolidayToAllGodowns, updateHoliday } from "@/services/holiday.service";
import { holidaySchema, HolidayFormData } from "@/schemas/holiday.schema";
import { HolidayEntry } from "@/types/holiday";
import { Site } from "@/types/site";

interface Props {
  siteId: string;
  sites: Site[];
  holiday?: HolidayEntry;
  onSuccess: () => void;
}

export default function HolidayForm({ siteId, sites, holiday, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(holiday?.dbId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HolidayFormData>({
    resolver: zodResolver(holidaySchema) as Resolver<HolidayFormData>,
    defaultValues: {
      siteId,
      holidayDate: holiday?.date || "",
      name: holiday && holiday.source === "CUSTOM" ? holiday.name : "",
      applyToAllGodowns: false,
    },
  });

  const applyToAllGodowns = useWatch({ control, name: "applyToAllGodowns" });

  async function onSubmit(data: HolidayFormData) {
    try {
      setLoading(true);

      if (isEditing && holiday?.dbId) {
        await updateHoliday(holiday.dbId, { holidayDate: data.holidayDate, name: data.name });
        toast.success("Holiday Updated Successfully");
      } else if (data.applyToAllGodowns) {
        await addHolidayToAllGodowns(data.holidayDate, data.name);
        toast.success("Holiday Added To All Godowns");
      } else {
        await addHoliday(data.siteId as string, data.holidayDate, data.name);
        toast.success("Holiday Added Successfully");
      }

      reset();
      onSuccess();
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
          <Label>Date *</Label>
          <Input type="date" {...register("holidayDate")} />
          {errors.holidayDate && <p className="text-sm text-red-500">{errors.holidayDate.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Holiday Name *</Label>
          <Input placeholder="e.g. Diwali" {...register("name")} />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>
      </div>

      {!isEditing && (
        <>
          <div className="space-y-2">
            <Label>Godown {!applyToAllGodowns && "*"}</Label>
            <Controller
              control={control}
              name="siteId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={applyToAllGodowns}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select godown" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id as string}>
                        {site.siteName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.siteId && <p className="text-sm text-red-500">{errors.siteId.message}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register("applyToAllGodowns")} />
            Apply to all godowns (e.g. a national holiday)
          </label>
        </>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Saving..." : isEditing ? "Update Holiday" : "Save Holiday"}
        </Button>
      </div>
    </form>
  );
}
