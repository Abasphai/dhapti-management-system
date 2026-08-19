import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import type { SidebarItem } from "@/layouts/DashboardLayout";

export type { SidebarItem };

interface SidebarProps {
  items: SidebarItem[];
  title: string;
}

export function Sidebar({ items, title }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
          {title}
        </h2>
      </div>
      <nav className="space-y-1 p-4">
        {items.map((item) => {
          if (item.children?.length) {
            return (
              <div key={item.label} className="space-y-1">
                <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                {item.children.map((child) => (
                  <NavLink
                    key={child.href}
                    to={child.href}
                    className={({ isActive }) =>
                      cn(
                        "portal-sidebar-link",
                        isActive && "portal-sidebar-link-active"
                      )
                    }
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            );
          }

          if (!item.href) return null;

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "portal-sidebar-link",
                  isActive && "portal-sidebar-link-active"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
