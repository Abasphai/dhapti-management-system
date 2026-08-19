import { BookOpen, Calendar, ClipboardCheck, FileText } from "lucide-react";

import {
  studentNavItems,
  teacherNavItems,
  adminNavItems,
  type SidebarItem,
} from "@/layouts/DashboardLayout";

export const studentSidebarItems: SidebarItem[] = studentNavItems;
export const teacherSidebarItems: SidebarItem[] = teacherNavItems;
export const adminSidebarItems: SidebarItem[] = adminNavItems;

/** Legacy / deep-link routes not shown in the DIU-style sidebar */
export const studentLegacyItems = [
  { label: "Schedule", href: "/student/schedule", icon: Calendar },
  { label: "Courses", href: "/student/courses", icon: BookOpen },
  { label: "Attendance", href: "/student/attendance", icon: ClipboardCheck },
  { label: "Assignments", href: "/student/assignments", icon: FileText },
];
