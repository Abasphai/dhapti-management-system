import { Link } from "react-router-dom";
import {
  ChevronDown,
  GraduationCap,
  Shield,
  UserCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const portalLinks = [
  {
    label: "Student Portal",
    href: "/student/login",
    icon: GraduationCap,
    description: "Access courses, grades & schedule",
  },
  {
    label: "Teacher Portal",
    href: "/teacher/login",
    icon: UserCircle,
    description: "Manage classes & assessments",
  },
  {
    label: "Admin Portal",
    href: "/admin/login",
    icon: Shield,
    description: "System administration",
  },
];

interface PortalLoginDropdownProps {
  className?: string;
  onNavigate?: () => void;
}

export function PortalLoginDropdown({
  className,
  onNavigate,
}: PortalLoginDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Portal Login
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="border-b bg-muted/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Portal
            </p>
          </div>
          <div className="p-2">
            {portalLinks.map((portal) => (
              <Link
                key={portal.href}
                to={portal.href}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <portal.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {portal.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {portal.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
