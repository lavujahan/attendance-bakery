import SiteDialog from "@/components/sites/SiteDialog";
import SiteTable from "@/components/sites/SiteTable";

export default function SitesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sites</h1>
          <p className="text-sm text-slate-500">Client site locations and geofence radius for kiosk check-in/out.</p>
        </div>
        <SiteDialog />
      </div>

      <SiteTable />
    </div>
  );
}
