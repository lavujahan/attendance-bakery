"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { toast } from "sonner";
import { subscribeSites } from "@/services/site.service";
import {
  deriveHolidayEntries,
  deriveRemovedSundays,
  deleteHoliday,
  removeSunday,
  restoreSunday,
  subscribeHolidayOverrides,
} from "@/services/holiday.service";
import { HolidayEntry, HolidayOverride } from "@/types/holiday";
import { Site } from "@/types/site";
import DeleteHolidayDialog from "./DeleteHolidayDialog";
import HolidayDialog from "./HolidayDialog";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function dayNameFor(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

export default function HolidayTable() {
  const now = new Date();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [overrides, setOverrides] = useState<HolidayOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<HolidayEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSites((data) => {
      setSites(data);
      setSiteId((current) => current || data[0]?.id || "");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!siteId) return;
    const unsubscribe = subscribeHolidayOverrides(siteId, year, month, (data) => {
      setOverrides(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [siteId, year, month]);

  const entries = useMemo(() => deriveHolidayEntries(year, month, overrides), [year, month, overrides]);
  const removedSundays = useMemo(() => deriveRemovedSundays(overrides), [overrides]);

  const handleMonthChange = (value: string) => {
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return;
    setYear(y);
    setMonth(m);
  };

  const handleRemoveSunday = async (date: string) => {
    if (!siteId) return;
    try {
      setBusyDate(date);
      await removeSunday(siteId, date);
      toast.success("Sunday Removed From Holidays");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusyDate(null);
    }
  };

  const handleRestoreSunday = async (date: string) => {
    if (!siteId) return;
    try {
      setBusyDate(date);
      await restoreSunday(siteId, date);
      toast.success("Sunday Restored As Holiday");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setBusyDate(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.dbId) return;

    try {
      setDeleting(true);
      await deleteHoliday(deleteTarget.dbId);
      setDeleteTarget(null);
      toast.success("Holiday Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  const sourceBadge = (entry: HolidayEntry) => (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        entry.source === "SUNDAY" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"
      }`}
    >
      {entry.source === "SUNDAY" ? "Default Sunday" : "Custom"}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="block font-medium">Godown</span>
            <select
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              className="w-full min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.siteCode} - {site.siteName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="block font-medium">Month</span>
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={(event) => handleMonthChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>

        {siteId && <HolidayDialog siteId={siteId} sites={sites} />}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">Loading holidays...</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Day</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      No holidays for {monthNames[month - 1]} {year}.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.date} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{formatDateLabel(entry.date)}</td>
                      <td className="p-3">{dayNameFor(entry.date)}</td>
                      <td className="p-3">{entry.name}</td>
                      <td className="p-3">{sourceBadge(entry)}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          {entry.source === "SUNDAY" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
                              disabled={busyDate === entry.date}
                              onClick={() => handleRemoveSunday(entry.date)}
                            >
                              Remove
                            </button>
                          ) : (
                            <>
                              <HolidayDialog
                                siteId={siteId}
                                sites={sites}
                                holiday={entry}
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
                                onClick={() => setDeleteTarget(entry)}
                              >
                                <FiTrash2 />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {entries.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-gray-500">
                No holidays for {monthNames[month - 1]} {year}.
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.date} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{formatDateLabel(entry.date)}</p>
                      <p className="text-xs text-slate-500">{dayNameFor(entry.date)}</p>
                    </div>
                    {sourceBadge(entry)}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{entry.name}</p>
                  <div className="mt-3 flex gap-2">
                    {entry.source === "SUNDAY" ? (
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={busyDate === entry.date}
                        onClick={() => handleRemoveSunday(entry.date)}
                      >
                        Remove
                      </button>
                    ) : (
                      <>
                        <HolidayDialog
                          siteId={siteId}
                          sites={sites}
                          holiday={entry}
                          trigger={
                            <button type="button" className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium">
                              Edit
                            </button>
                          }
                        />
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-600"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {removedSundays.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Removed Sundays this month</h3>
              <p className="mt-1 text-xs text-slate-500">These Sundays were turned back into working days for this godown.</p>
              <div className="mt-3 space-y-2">
                {removedSundays.map((override) => (
                  <div
                    key={override.holidayDate}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span>{formatDateLabel(override.holidayDate)}</span>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
                      disabled={busyDate === override.holidayDate}
                      onClick={() => handleRestoreSunday(override.holidayDate)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <DeleteHolidayDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
