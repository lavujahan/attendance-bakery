import { Activity, CheckCircle2, Clock3, MapPinned, UserCheck, UserX, Users } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import type { DashboardSummary } from "@/services/dashboard.service";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <StatCard title="Total Employees" value={summary.totalEmployees} icon={Users} color="bg-sky-600" />
      <StatCard title="Total Sites" value={summary.totalSites} icon={MapPinned} color="bg-violet-600" />
      <StatCard title="Present Today" value={summary.presentToday} icon={UserCheck} color="bg-emerald-700" />
      <StatCard title="Absent Today" value={summary.absentToday} icon={UserX} color="bg-rose-600" />
      <StatCard title="Checked-In" value={summary.checkedIn} icon={Activity} color="bg-cyan-600" />
      <StatCard title="Checked-Out" value={summary.checkedOut} icon={CheckCircle2} color="bg-blue-600" />
      <StatCard title="Late Arrivals" value={summary.lateArrivals} icon={Clock3} color="bg-orange-600" />
      <StatCard title="Early Leavers" value={summary.earlyLeavers} icon={Clock3} color="bg-fuchsia-600" />
      <StatCard title="Attendance %" value={`${summary.attendancePercentage}%`} icon={Activity} color="bg-indigo-600" />
    </div>
  );
}
