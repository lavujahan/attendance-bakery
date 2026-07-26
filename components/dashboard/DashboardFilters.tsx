import type { Site } from "@/types/site";
import type { DashboardFilters } from "@/services/dashboard.service";

interface DashboardFiltersProps {
  filters: DashboardFilters;
  sites: Site[];
  onFiltersChange: (filters: DashboardFilters) => void;
}

export default function DashboardFilters({ filters, sites, onFiltersChange }: DashboardFiltersProps) {
  function handleFieldChange(field: keyof DashboardFilters, value: string) {
    onFiltersChange({ ...filters, [field]: value });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <label className="block max-w-xs space-y-2 text-sm">
        <span className="font-medium text-slate-700">Site</span>
        <select
          value={filters.siteId}
          onChange={(event) => handleFieldChange("siteId", event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="">All Sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.siteName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
