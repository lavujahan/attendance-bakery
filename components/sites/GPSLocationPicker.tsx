"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GPSLocationPickerProps {
  value?: { latitude: number | null; longitude: number | null; accuracy: number | null };
  onChange: (value: { latitude: number | null; longitude: number | null; accuracy: number | null }) => void;
}

export default function GPSLocationPicker({ value, onChange }: GPSLocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      const message = "Geolocation is not supported by this browser.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (geoError) => {
        setLoading(false);
        const message = getGeoErrorMessage(geoError);
        setError(message);
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [onChange]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium text-slate-900">Godown Location</h3>
          <p className="text-sm text-slate-500">GPS coordinates are captured automatically for attendance validation.</p>
        </div>
        <Button type="button" variant="outline" onClick={captureLocation} disabled={loading} className="w-full sm:w-auto">
          {loading ? "Capturing..." : "Capture Current Location"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Latitude</Label>
          <Input value={value?.latitude ?? ""} readOnly placeholder="" />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input value={value?.longitude ?? ""} readOnly placeholder="" />
        </div>
        <div>
          <Label>Accuracy</Label>
          <Input value={value?.accuracy ? `${value.accuracy.toFixed(1)} m` : ""} readOnly placeholder="" />
        </div>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

function getGeoErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission is required to create a godown.";
    case error.POSITION_UNAVAILABLE:
      return "Location information is unavailable at the moment.";
    case error.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "Unable to capture your location right now.";
  }
}
