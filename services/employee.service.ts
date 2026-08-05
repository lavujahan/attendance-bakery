import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { calculateSalaryPerHour } from "@/lib/attendanceMath";
import { EmployeeFormData } from "@/schemas/employee.schema";
import { Employee } from "@/types/employee";
import type { Site } from "@/types/site";

const TABLE = "employees";

type EmployeeRow = {
  id: string;
  employee_code: string;
  employee_name: string;
  mobile_number: string;
  serial_no: number;
  gender: "Male" | "Female" | "Other";
  designation: string;
  joining_date: string;
  daily_start_time: string;
  daily_end_time: string;
  face_enrolled: boolean;
  status: "Active" | "Inactive";
  salary_per_day: number;
  salary_per_hour: number;
  id_proof_url: string | null;
  site_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    mobileNumber: row.mobile_number,
    serialNo: row.serial_no,
    gender: row.gender,
    designation: row.designation,
    joiningDate: row.joining_date,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    faceEnrolled: row.face_enrolled,
    status: row.status,
    salaryPerDay: row.salary_per_day,
    salaryPerHour: row.salary_per_hour,
    idProofUrl: row.id_proof_url ?? undefined,
    siteId: row.site_id ?? undefined,
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
      gender: data.gender,
      designation: data.designation,
      joining_date: data.joiningDate,
      daily_start_time: toDbTime(data.dailyStartTime),
      daily_end_time: toDbTime(data.dailyEndTime),
      status: data.status,
      salary_per_day: data.salaryPerDay,
      salary_per_hour: calculateSalaryPerHour(data.salaryPerDay, data.dailyStartTime, data.dailyEndTime),
      id_proof_url: data.idProofUrl ?? null,
      site_id: data.siteId,
    })
    .select()
    .single();

  if (error) {
    // employee_serial_no_seq is NO CYCLE, MAXVALUE 99 -- nextval() raises SQLSTATE
    // 2200H once all 89 slots (11-99) are taken, instead of silently reusing or
    // overflowing. Surface that as a message an admin can actually act on.
    if (error.code === "2200H" || error.message?.toLowerCase().includes("reached maximum value")) {
      throw new Error("All Serial Numbers (11-99) are in use. Delete an employee or contact your administrator to free one up.");
    }
    throw error;
  }

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

  // Unique per call -- see the comment in site.service.ts's subscribeSites for why a
  // shared constant channel name breaks once more than one subscriber can be mounted
  // at the same time.
  const channel = supabaseBrowser
    .channel(`employees-changes-${crypto.randomUUID()}`)
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
      gender: data.gender,
      designation: data.designation,
      joining_date: data.joiningDate,
      daily_start_time: toDbTime(data.dailyStartTime),
      daily_end_time: toDbTime(data.dailyEndTime),
      status: data.status,
      salary_per_day: data.salaryPerDay,
      salary_per_hour: calculateSalaryPerHour(data.salaryPerDay, data.dailyStartTime, data.dailyEndTime),
      id_proof_url: data.idProofUrl ?? null,
      site_id: data.siteId,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabaseBrowser.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function exportEmployeesPDF(employees: Employee[], sites: Site[]) {
  const siteMap = new Map(sites.map((site) => [site.id, site]));
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.text("Employees", 40, 36);
  doc.setFontSize(10);
  doc.text("Company: Attendance Management System", 40, 56);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 72);

  const headers = [
    "Employee Code",
    "Serial No",
    "Name",
    "Mobile Number",
    "Gender",
    "Designation",
    "Joining Date",
    "Daily Start Time",
    "Daily End Time",
    "Salary/day",
    "Godown",
    "Face Enrolled",
    "Status",
    "ID Proof Link",
  ];

  const rows = employees.map((employee) => [
    employee.employeeCode,
    String(employee.serialNo),
    employee.employeeName,
    employee.mobileNumber,
    employee.gender,
    employee.designation,
    employee.joiningDate,
    employee.dailyStartTime?.slice(0, 5) ?? "",
    employee.dailyEndTime?.slice(0, 5) ?? "",
    employee.salaryPerDay.toFixed(2),
    (employee.siteId && siteMap.get(employee.siteId)?.siteName) || "—",
    employee.faceEnrolled ? "Yes" : "No",
    employee.status,
    employee.idProofUrl ?? "—",
  ]);

  autoTable(doc, {
    startY: 92,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [29, 78, 216] },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 20);
    },
  });

  doc.save("employees.pdf");
  toast.success("Employees exported to PDF");
}
