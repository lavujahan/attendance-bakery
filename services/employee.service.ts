import { supabaseBrowser } from "@/lib/supabase/client";
import { EmployeeFormData } from "@/schemas/employee.schema";
import { Employee } from "@/types/employee";

const TABLE = "employees";

type EmployeeRow = {
  id: string;
  employee_code: string;
  employee_name: string;
  mobile_number: string;
  phone_prefix: string;
  email: string;
  gender: "Male" | "Female" | "Other";
  designation: string;
  joining_date: string;
  daily_start_time: string;
  daily_end_time: string;
  face_enrolled: boolean;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};

function mapRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    mobileNumber: row.mobile_number,
    phonePrefix: row.phone_prefix,
    email: row.email,
    gender: row.gender,
    designation: row.designation,
    joiningDate: row.joining_date,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    faceEnrolled: row.face_enrolled,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbTime(time: string) {
  // "HH:MM" from the form -> "HH:MM:00" for the `time` column
  return time.length === 5 ? `${time}:00` : time;
}

export async function addEmployee(data: EmployeeFormData) {
  const { data: inserted, error } = await supabaseBrowser
    .from(TABLE)
    .insert({
      employee_name: data.employeeName,
      mobile_number: data.mobileNumber,
      email: data.email || "",
      gender: data.gender,
      designation: data.designation,
      joining_date: data.joiningDate,
      daily_start_time: toDbTime(data.dailyStartTime),
      daily_end_time: toDbTime(data.dailyEndTime),
      status: data.status,
    })
    .select()
    .single();

  if (error) throw error;

  return mapRow(inserted as EmployeeRow);
}

export async function getEmployees() {
  const { data, error } = await supabaseBrowser
    .from(TABLE)
    .select("*")
    .order("employee_code", { ascending: true });

  if (error) throw error;

  return (data as EmployeeRow[]).map(mapRow);
}

export function subscribeEmployees(callback: (employees: Employee[]) => void) {
  let cancelled = false;

  const refetch = async () => {
    const employees = await getEmployees();
    if (!cancelled) callback(employees);
  };

  void refetch();

  const channel = supabaseBrowser
    .channel("employees-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => void refetch())
    .subscribe();

  return () => {
    cancelled = true;
    supabaseBrowser.removeChannel(channel);
  };
}

export async function updateEmployee(id: string, data: EmployeeFormData) {
  const { error } = await supabaseBrowser
    .from(TABLE)
    .update({
      employee_name: data.employeeName,
      mobile_number: data.mobileNumber,
      email: data.email || "",
      gender: data.gender,
      designation: data.designation,
      joining_date: data.joiningDate,
      daily_start_time: toDbTime(data.dailyStartTime),
      daily_end_time: toDbTime(data.dailyEndTime),
      status: data.status,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabaseBrowser.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
