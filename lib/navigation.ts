import {
  LayoutDashboard,
  Users,
  MapPinned,
  ClipboardCheck,
  FileBarChart2,
  Settings,
} from "lucide-react";

export const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Godowns", href: "/dashboard/sites", icon: MapPinned },
  { title: "Employees", href: "/dashboard/employees", icon: Users },
  { title: "Attendance Management", href: "/dashboard/attendance-management", icon: ClipboardCheck },
  { title: "Reports", href: "/dashboard/reports", icon: FileBarChart2 },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
