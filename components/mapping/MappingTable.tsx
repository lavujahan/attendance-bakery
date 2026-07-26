"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GroupedEmployeeSiteMapping } from "@/types/employeeSiteMapping";

interface Props {
  mappings: GroupedEmployeeSiteMapping[];
  onEdit: (mapping: GroupedEmployeeSiteMapping) => void;
  onDelete: (mapping: GroupedEmployeeSiteMapping) => void;
}

export default function MappingTable({ mappings, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState("");

  const filteredMappings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return mappings;

    return mappings.filter((item) =>
      [item.siteCode, item.siteName, item.clientName, item.fromDate, item.toDate].join(" ").toLowerCase().includes(query)
    );
  }, [mappings, search]);

  const statusBadge = (status: GroupedEmployeeSiteMapping["status"]) => (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      }`}
    >
      {status}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Existing Mappings</h3>
          <p className="text-sm text-slate-500">Search across site, client, or dates.</p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search mappings"
          className="w-full sm:max-w-xs"
        />
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {filteredMappings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No mappings found.
          </div>
        ) : (
          filteredMappings.map((mapping) => (
            <div key={mapping.mappingGroupId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{mapping.siteName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{mapping.siteCode}</p>
                </div>
                {statusBadge(mapping.status)}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>Client: {mapping.clientName}</p>
                <p>{mapping.employeeCount} employees</p>
                <p>
                  {mapping.fromDate} → {mapping.toDate}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium"
                  onClick={() => onEdit(mapping)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-600"
                  onClick={() => onDelete(mapping)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site Code</TableHead>
              <TableHead>Site Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>From Date</TableHead>
              <TableHead>To Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                  No mappings found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMappings.map((mapping) => (
                <TableRow key={mapping.mappingGroupId}>
                  <TableCell>{mapping.siteCode}</TableCell>
                  <TableCell>{mapping.siteName}</TableCell>
                  <TableCell>{mapping.clientName}</TableCell>
                  <TableCell>{mapping.employeeCount}</TableCell>
                  <TableCell>{mapping.fromDate}</TableCell>
                  <TableCell>{mapping.toDate}</TableCell>
                  <TableCell>{statusBadge(mapping.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(mapping)}>
                        Edit
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(mapping)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
