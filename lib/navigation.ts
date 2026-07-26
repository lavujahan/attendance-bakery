import {
  LayoutDashboard,
  Users,
  MapPinned,
  Link2,
  ClipboardCheck,
  FileBarChart2,
  Settings,
} from "lucide-react";

export const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", href: "/dashboard/employees", icon: Users },
  { title: "Sites", href: "/dashboard/sites", icon: MapPinned },
  { title: "Employee Mapping", href: "/dashboard/employee-site-mapping", icon: Link2 },
  { title: "Attendance Management", href: "/dashboard/attendance-management", icon: ClipboardCheck },
  { title: "Reports", href: "/dashboard/reports", icon: FileBarChart2 },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
