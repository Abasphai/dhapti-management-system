export type PortalType = "student" | "teacher" | "admin";

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: PortalType | "guest";
  avatar?: string;
}

export interface PageMeta {
  title: string;
  description?: string;
}
