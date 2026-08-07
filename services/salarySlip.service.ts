import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import { minutesToHoursLabel } from "@/lib/payrollMath";
import type { SalaryCycle, SalaryRecord } from "@/types/salary";

// Reuses the same jsPDF + jspdf-autotable construction pattern as
// services/dashboard.service.ts's exportPDF, but as a single-record slip document rather
// than a generic tabular export.
export function generateSalarySlipPDF(record: SalaryRecord, cycle: SalaryCycle): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a5" });

  doc.setFontSize(16);
  doc.text("Salary Slip", 40, 40);
  doc.setFontSize(10);
  doc.text(`Cycle: ${cycle.fromDate} to ${cycle.toDate}`, 40, 60);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 74);

  doc.setFontSize(11);
  doc.text(`Employee: ${record.employeeName} (${record.employeeCode})`, 40, 98);
  doc.text(`Designation: ${record.designation}`, 40, 114);
  doc.text(`Godown: ${record.siteName}`, 40, 130);

  const hasOverride = record.overridePayableMinutes !== undefined && record.overridePayableMinutes !== null;

  const rows: string[][] = [
    ["Worked Hours", minutesToHoursLabel(record.workedMinutes)],
    ["Deduction", minutesToHoursLabel(record.deductionMinutes)],
    ["Payable Hours", minutesToHoursLabel(record.payableMinutes)],
    ["Hourly Rate", record.hourlyRate.toFixed(2)],
    ["Gross Salary", record.grossSalaryAmount.toFixed(2)],
  ];

  if (hasOverride) {
    rows.push(["Override Hours", minutesToHoursLabel(record.overridePayableMinutes ?? 0)]);
    rows.push(["Override Reason", `${record.overrideReasonCategory ?? ""} — ${record.overrideNote ?? ""}`]);
  }

  rows.push(["Final Salary", record.finalSalaryAmount.toFixed(2)]);

  autoTable(doc, {
    startY: 150,
    head: [["Item", "Value"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [29, 78, 216] },
  });

  doc.save(`${record.employeeCode}-${cycle.fromDate}-slip.pdf`);
}
