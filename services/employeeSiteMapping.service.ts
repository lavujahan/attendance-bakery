import { supabaseBrowser } from "@/lib/supabase/client";
import type { Employee } from "@/types/employee";
import type { Site } from "@/types/site";
import type { EmployeeSiteMapping } from "@/types/employeeSiteMapping";
import type { EmployeeSiteMappingFormValues } from "@/schemas/employeeSiteMapping.schema";

const TABLE = "employee_site_mappings";

type MappingRow = {
  id: string;
  group_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  site_id: string;
  site_code: string;
  site_name: string;
  client_name: string;
  from_date: string;
  to_date: string;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};

function mapRow(row: MappingRow): EmployeeSiteMapping {
  return {
    id: row.id,
    mappingGroupId: row.group_id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    siteId: row.site_id,
    siteCode: row.site_code,
    siteName: row.site_name,
    clientName: row.client_name,
    fromDate: row.from_date,
    toDate: row.to_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllEmployeeSiteMappings() {
  const { data, error } = await supabaseBrowser.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) throw error;

  return (data as MappingRow[]).map(mapRow);
}

export async function getEmployeeSiteMappings() {
  return getAllEmployeeSiteMappings();
}

export function subscribeEmployeeSiteMappings(callback: (mappings: EmployeeSiteMapping[]) => void) {
  let cancelled = false;

  const refetch = async () => {
    const mappings = await getAllEmployeeSiteMappings();
    if (!cancelled) callback(mappings);
  };

  void refetch();

  const channel = supabaseBrowser
    .channel("employee-site-mappings-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refetch())
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}

type AssignmentResult = { assignedCount: number; skippedCount: number; skippedEmployees: string[]; mappingGroupId: string };

function summarizeRpcResult(
  rpcRows: { employee_id: string; assigned: boolean }[],
  selectedEmployees: Employee[],
  mappingGroupId: string
): AssignmentResult {
  const nameById = new Map(selectedEmployees.map((employee) => [employee.id, employee.employeeName]));
  const skippedEmployees = rpcRows
    .filter((row) => !row.assigned)
    .map((row) => nameById.get(row.employee_id) ?? row.employee_id);
  const assignedCount = rpcRows.filter((row) => row.assigned).length;

  return { assignedCount, skippedCount: skippedEmployees.length, skippedEmployees, mappingGroupId };
}

export async function saveEmployeeSiteMappings(
  values: EmployeeSiteMappingFormValues,
  selectedEmployees: Employee[],
  site: Site
): Promise<AssignmentResult> {
  const mappingGroupId = crypto.randomUUID();
  const employeeIds = selectedEmployees.map((employee) => employee.id).filter(Boolean) as string[];

  const { data, error } = await supabaseBrowser.rpc("save_employee_site_mappings", {
    p_group_id: mappingGroupId,
    p_site_id: site.id,
    p_from_date: values.fromDate,
    p_to_date: values.toDate,
    p_status: values.status,
    p_employee_ids: employeeIds,
  });

  if (error) throw error;

  return summarizeRpcResult(data, selectedEmployees, mappingGroupId);
}

export async function updateEmployeeSiteMappings(
  mappingGroupId: string,
  values: EmployeeSiteMappingFormValues,
  selectedEmployees: Employee[],
  site: Site
): Promise<AssignmentResult> {
  const employeeIds = selectedEmployees.map((employee) => employee.id).filter(Boolean) as string[];

  const { data, error } = await supabaseBrowser.rpc("update_employee_site_mappings", {
    p_group_id: mappingGroupId,
    p_site_id: site.id,
    p_from_date: values.fromDate,
    p_to_date: values.toDate,
    p_status: values.status,
    p_employee_ids: employeeIds,
  });

  if (error) throw error;

  return summarizeRpcResult(data, selectedEmployees, mappingGroupId);
}

export async function deleteEmployeeSiteMappings(mappingGroupId: string) {
  const { error } = await supabaseBrowser.from(TABLE).delete().eq("group_id", mappingGroupId);
  if (error) throw error;
}
