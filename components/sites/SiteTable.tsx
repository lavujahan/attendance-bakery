"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiSearch, FiTrash2 } from "react-icons/fi";
import { toast } from "sonner";
import { deleteSite, subscribeSites } from "@/services/site.service";
import { Site } from "@/types/site";
import DeleteSiteDialog from "./DeleteSiteDialog";
import SiteDialog from "./SiteDialog";

export default function SiteTable() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSites((data) => {
      setSites(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSites = useMemo(() => {
    const value = search.toLowerCase().trim();

    return sites.filter(
      (site) =>
        site.siteCode?.toLowerCase().includes(value) ||
        site.siteName?.toLowerCase().includes(value) ||
        site.clientName?.toLowerCase().includes(value) ||
        site.siteIncharge?.toLowerCase().includes(value)
    );
  }, [sites, search]);

  const handleDelete = async () => {
    if (!selectedSite?.id) return;

    try {
      setDeleting(true);
      await deleteSite(selectedSite.id);
      setDeleteOpen(false);
      setSelectedSite(null);
      toast.success("Site Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border bg-white p-6">Loading sites...</div>;
  }

  const statusBadge = (site: Site) => (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        site.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {site.status}
    </span>
  );

  const geofenceBadge = (site: Site) => (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        site.geofenceEnabled ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      Geofence: {site.geofenceEnabled ? "On" : "Off"}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-md">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input
          className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {filteredSites.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-gray-500">No sites found.</div>
        ) : (
          filteredSites.map((site) => (
            <div key={site.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{site.siteName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{site.siteCode}</p>
                </div>
                {statusBadge(site)}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>Client: {site.clientName}</p>
                <p>Incharge: {site.siteIncharge}</p>
                <p>
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.allowedRadius} m radius
                </p>
              </div>
              <div className="mt-3">{geofenceBadge(site)}</div>
              <div className="mt-4 flex gap-2">
                <SiteDialog
                  site={site}
                  trigger={
                    <button type="button" className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium">
                      Edit
                    </button>
                  }
                />
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-600"
                  onClick={() => {
                    setSelectedSite(site);
                    setDeleteOpen(true);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Site Name</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-left">Incharge</th>
              <th className="p-3 text-left">Latitude</th>
              <th className="p-3 text-left">Longitude</th>
              <th className="p-3 text-left">Radius</th>
              <th className="p-3 text-left">Geofence</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-500">
                  No sites found.
                </td>
              </tr>
            ) : (
              filteredSites.map((site) => (
                <tr key={site.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{site.siteCode}</td>
                  <td className="p-3 font-medium text-slate-900">{site.siteName}</td>
                  <td className="p-3">{site.clientName}</td>
                  <td className="p-3">{site.siteIncharge}</td>
                  <td className="p-3">{site.latitude}</td>
                  <td className="p-3">{site.longitude}</td>
                  <td className="p-3">{site.allowedRadius} m</td>
                  <td className="p-3">{geofenceBadge(site)}</td>
                  <td className="p-3">{statusBadge(site)}</td>
                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <SiteDialog
                        site={site}
                        trigger={
                          <button type="button" className="rounded-lg p-2 hover:bg-blue-100" title="Edit">
                            <FiEdit2 />
                          </button>
                        }
                      />
                      <button
                        type="button"
                        className="rounded-lg p-2 hover:bg-red-100"
                        title="Delete"
                        onClick={() => {
                          setSelectedSite(site);
                          setDeleteOpen(true);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteSiteDialog open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={handleDelete} deleting={deleting} />
    </div>
  );
}
