"use client";

import { useRouter } from "next/navigation";
import { Clock3, UserCheck, UserX, Users } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import type { DashboardSummary } from "@/services/dashboard.service";

interface SummaryCardsProps {
  summary: DashboardSummary;
  siteId: string;
}

export default function SummaryCards({ summary, siteId }: SummaryCardsProps) {
  const router = useRouter();

  function goToReport(reportType: string) {
    const params = new URLSearchParams({ type: reportType, datePreset: "today" });
    if (siteId) params.set("siteId", siteId);
    router.push(`/dashboard/reports?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <StatCard
        title="Total Employees"
        value={summary.totalEmployees}
        icon={Users}
        color="bg-sky-600"
        onClick={() => goToReport("employee")}
      />
      <StatCard
        title="Present Today"
        value={summary.presentToday}
        icon={UserCheck}
        color="bg-emerald-700"
        onClick={() => goToReport("present")}
      />
      <StatCard
        title="Absent Today"
        value={summary.absentToday}
        icon={UserX}
        color="bg-rose-600"
        onClick={() => goToReport("absent")}
      />
      <StatCard
        title="Late Arrivals"
        value={summary.lateArrivals}
        icon={Clock3}
        color="bg-orange-600"
        onClick={() => goToReport("late")}
      />
      <StatCard
        title="Early Leavers"
        value={summary.earlyLeavers}
        icon={Clock3}
        color="bg-fuchsia-600"
        onClick={() => goToReport("early")}
      />
    </div>
  );
}
