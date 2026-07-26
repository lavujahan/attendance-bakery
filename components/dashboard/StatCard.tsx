import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
}

export default function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-lg sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{value}</h2>
        </div>

        <div className={`rounded-xl p-3 ${color} shrink-0`}>
          <Icon className="text-white" size={20} />
        </div>
      </div>
    </div>
  );
}
