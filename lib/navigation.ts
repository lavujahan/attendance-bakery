import {
  LayoutDashboard,
  Users,
  MapPinned,
  CalendarDays,
  ClipboardCheck,
  FileBarChart2,
  Settings,
  Wallet,
} from "lucide-react";

export const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Godowns", href: "/dashboard/sites", icon: MapPinned },
  { title: "Holidays", href: "/dashboard/holidays", icon: CalendarDays },
  { title: "Employees", href: "/dashboard/employees", icon: Users },
  { title: "Attendance Management", href: "/dashboard/attendance-management", icon: ClipboardCheck },
  { title: "Salary", href: "/dashboard/salary", icon: Wallet },
  { title: "Reports", href: "/dashboard/reports", icon: FileBarChart2 },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
