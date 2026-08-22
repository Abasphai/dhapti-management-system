import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DollarSign,
  Download,
  Droplets,
  FileText,
  Globe,
  GraduationCap,
  Home,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Library,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  PenLine,
  QrCode,
  Search,
  Settings,
  ScrollText,
  Star,
  Sun,
  Timer,
  User,
  UserPlus,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";

import { LayoutSettingsPopover } from "@/components/common/LayoutSettingsPopover";
import { NotificationBell } from "@/components/common/NotificationBell";
import { Input } from "@/components/ui/input";
import { AvatarProvider, useOptionalAvatar } from "@/context/AvatarContext";
import { THEME_PRESET_COLORS, useLayout } from "@/context/LayoutContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export interface SidebarChild {
  label: string;
  href: string;
}

export interface SidebarItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: SidebarChild[];
}

export const studentNavItems: SidebarItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "My Courses", href: "/student/courses", icon: BookOpen },
  {
    label: "Evaluate Lecturer",
    href: "/student/evaluate-teacher",
    icon: Star,
  },
  {
    label: "Education Materials",
    href: "/student/education-materials",
    icon: Library,
  },
  { label: "Class Routine", href: "/student/routine", icon: CalendarRange },
  { label: "Assignments", href: "/student/assignments", icon: FileText },
  { label: "Quizzes", href: "/student/quizzes", icon: ClipboardCheck },
  { label: "Attendance", href: "/student/attendance", icon: ClipboardList },
  {
    label: "Result",
    icon: Award,
    children: [
      { label: "Semester Result", href: "/student/results" },
      { label: "Improvement Result", href: "/student/improvement-result" },
      { label: "Eligible Subject", href: "/student/eligible-subjects" },
      { label: "Admit Card", href: "/student/admit-card" },
    ],
  },
  {
    label: "Payment Info",
    icon: CreditCard,
    children: [
      { label: "Fees & Payments", href: "/student/fees" },
      { label: "Account Details", href: "/student/account-details" },
      { label: "Hostel Fees", href: "/student/hostel-fees" },
    ],
  },
  { label: "Elections", href: "/student/elections", icon: Vote },
  { label: "Notifications", href: "/student/notifications", icon: Bell },
  { label: "Digital ID Card", href: "/student/id-card", icon: IdCard },
  { label: "Download Forms", href: "/student/download-forms", icon: Download },
  { label: "Profile", href: "/student/profile", icon: User },
  { label: "Mail Account", href: "/student/mail", icon: Mail },
  { label: "Support Ticket", href: "/student/support-ticket", icon: LifeBuoy },
  { label: "Blood Bank", href: "/student/blood-bank", icon: Droplets },
];

export const teacherNavItems: SidebarItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "My Classes", href: "/teacher/classes", icon: CalendarRange },
  { label: "My Courses", href: "/teacher/courses", icon: BookOpen },
  {
    label: "Education Materials",
    href: "/teacher/materials",
    icon: Library,
  },
  {
    label: "My Attendance (Check-in/Out)",
    href: "/teacher/my-attendance",
    icon: ClipboardCheck,
  },
  {
    label: "Student Class Attendance",
    href: "/teacher/student-attendance",
    icon: ClipboardList,
  },
  { label: "Assignments", href: "/teacher/assignments", icon: FileText },
  { label: "Quizzes", href: "/teacher/quizzes", icon: ClipboardCheck },
  { label: "Assignment Grading", href: "/teacher/grading", icon: PenLine },
  { label: "Student List", href: "/teacher/students", icon: Users },
  { label: "Gradebook", href: "/teacher/course-results", icon: Award },
  { label: "My Performance", href: "/teacher/performance", icon: Star },
  { label: "Student Questions", href: "/teacher/questions", icon: MessageSquare },
  { label: "Notifications", href: "/teacher/notifications", icon: Bell },
  { label: "Digital ID Card", href: "/teacher/id-card", icon: IdCard },
  { label: "Profile", href: "/teacher/profile", icon: User },
];

export const adminNavItems: SidebarItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Analytics & Intelligence",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    label: "Department Dashboard",
    href: "/admin/department-dashboard",
    icon: Building2,
  },
  { label: "User Management", href: "/admin/users", icon: Users },
  { label: "Manage Students", href: "/admin/students", icon: UserPlus },
  { label: "Manage Teachers", href: "/admin/teachers", icon: GraduationCap },
  {
    label: "Teacher Performance",
    href: "/admin/teacher-performance",
    icon: Star,
  },
  { label: "Manage Classes", href: "/admin/classes", icon: CalendarRange },
  { label: "Manage Enrollments", href: "/admin/enrollments", icon: ClipboardList },
  { label: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  {
    label: "Teacher Class Monitor",
    href: "/admin/teacher-attendance",
    icon: Timer,
  },
  {
    label: "Attendance Locations",
    href: "/admin/attendance-locations",
    icon: QrCode,
  },
  { label: "Grade Review", href: "/admin/grades", icon: PenLine },
  { label: "Results Approval", href: "/admin/course-results", icon: Award },
  {
    label: "Exam Control",
    href: "/admin/exam-control",
    icon: ClipboardCheck,
  },
  { label: "Certificates", href: "/admin/certificates", icon: Award },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  { label: "Admissions Queue", href: "/admin/admissions", icon: UserPlus },
  { label: "Finance & Fees", href: "/admin/finance", icon: DollarSign },
  { label: "Faculties & Departments", href: "/admin/faculties", icon: Building2 },
  { label: "Elections", href: "/admin/elections", icon: Vote },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  {
    label: "Website CMS",
    icon: Globe,
    children: [
      { label: "Overview", href: "/admin/cms" },
      { label: "Site Settings", href: "/admin/cms/settings" },
      { label: "Homepage", href: "/admin/cms/home" },
      { label: "Pages", href: "/admin/cms/pages" },
      { label: "Custom Pages", href: "/admin/cms/custom-pages" },
      { label: "News", href: "/admin/cms/news" },
      { label: "Events", href: "/admin/cms/events" },
      { label: "Faculties", href: "/admin/cms/faculties" },
      { label: "Programs", href: "/admin/cms/programs" },
      { label: "Media Library", href: "/admin/cms/media" },
      { label: "Navigation", href: "/admin/cms/navigation" },
    ],
  },
  { label: "System Settings", href: "/admin/settings", icon: Settings },
];

interface DashboardUser {
  name: string;
  id: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

interface DashboardLayoutProps {
  portalName: string;
  sidebarItems: SidebarItem[];
  loginPath: string;
  activeAccent?: "green" | "orange";
  user?: DashboardUser;
}

const PROFILE_PHOTO = "/images/profile-user.jpg";

const DEFAULT_STUDENT: DashboardUser = {
  name: "Mohamud Mohamed Abas",
  id: "DHAPTI-2024-001",
  email: "mohamudcade143@gmail.com",
  role: "Student",
  avatarUrl: PROFILE_PHOTO,
};

const DEFAULT_TEACHER: DashboardUser = {
  name: "Prof. Mohamed",
  id: "DHAPTI-FAC-014",
  email: "mohamed.ali@dhapti.edu.so",
  role: "Faculty",
  avatarUrl: PROFILE_PHOTO,
};

const DEFAULT_ADMIN: DashboardUser = {
  name: "Admin User",
  id: "DHAPTI-ADM-001",
  email: "admin@dhapti.edu.so",
  role: "Administrator",
  avatarUrl: PROFILE_PHOTO,
};

/** University branding mark — never use personal photos here */
function BrandLogo({ sizeClass = "h-12 md:h-14 w-auto" }: { sizeClass?: string }) {
  return (
    <img
      src="/dhapti-logo.png"
      alt="Dhapti University"
      className={cn("shrink-0 object-contain", sizeClass)}
    />
  );
}

type PortalKind = "student" | "teacher" | "admin";

function getPortalKind(pathname: string): PortalKind {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/teacher")) return "teacher";
  return "student";
}

const PORTAL_BADGE: Record<
  PortalKind,
  { label: string; className: string }
> = {
  student: {
    label: "STUDENT PORTAL",
    className:
      "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  },
  teacher: {
    label: "FACULTY PORTAL",
    className: "border-orange-400/35 bg-orange-500/15 text-orange-300",
  },
  admin: {
    label: "ADMIN PORTAL",
    className: "border-red-400/35 bg-red-500/15 text-red-300",
  },
};

function SidebarBrandHeader({
  collapsed = false,
  onNavigate,
  trailing,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  trailing?: ReactNode;
}) {
  const location = useLocation();
  const portal = getPortalKind(location.pathname);
  const badge = PORTAL_BADGE[portal];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center border-b border-white/5",
        collapsed ? "justify-center px-2 py-4" : "gap-2 px-4 py-4",
        trailing && !collapsed && "justify-between"
      )}
    >
      <Link
        to="/"
        onClick={onNavigate}
        title="Back to Home — View Public Website"
        className={cn(
          "group flex min-w-0 items-center transition-opacity hover:opacity-95",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <BrandLogo
          sizeClass={collapsed ? "h-10 w-auto max-w-[44px]" : "h-12 md:h-14 w-auto"}
        />

        {!collapsed && (
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-sans text-lg font-bold leading-none tracking-tight text-white">
              DHAPTI
            </p>
            <p className="mt-1 text-[10px] font-medium leading-tight text-white/60">
              Dhapti University
            </p>
            <span
              className={cn(
                "mt-2 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]",
                badge.className
              )}
            >
              {badge.label}
            </span>
          </div>
        )}
      </Link>

      {trailing}
    </div>
  );
}

function flattenNav(items: SidebarItem[]) {
  return items.flatMap((item) => {
    if (item.children?.length) {
      return item.children.map((child) => ({
        label: child.label,
        href: child.href,
      }));
    }
    return item.href ? [{ label: item.label, href: item.href }] : [];
  });
}

function isGroupActive(item: SidebarItem, pathname: string) {
  return (
    item.children?.some(
      (child) =>
        pathname === child.href || pathname.startsWith(`${child.href}/`)
    ) ?? false
  );
}

function UserAvatar({
  user,
  sizeClass,
  borderClass,
}: {
  user: DashboardUser;
  sizeClass: string;
  borderClass: string;
}) {
  const sessionAvatar = useOptionalAvatar();
  const src = sessionAvatar?.avatarUrl || user.avatarUrl || PROFILE_PHOTO;

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full bg-[#E5EBF3] shadow-sm",
        sizeClass,
        borderClass
      )}
    >
      <img
        src={src}
        alt={user.name}
        className="h-full w-full rounded-full object-cover object-center"
      />
    </div>
  );
}

function getPortalLinks(pathname: string) {
  if (pathname.startsWith("/teacher")) {
    return {
      profile: "/teacher/dashboard",
      support: "/teacher/notifications",
      password: "/teacher/dashboard",
    };
  }
  if (pathname.startsWith("/admin")) {
    return {
      profile: "/admin/settings",
      support: "/admin/settings",
      password: "/admin/settings",
    };
  }
  return {
    profile: "/student/profile",
    fees: "/student/fees",
    support: "/student/support",
    password: "/student/profile?tab=password",
  };
}

function TopbarProfileMenu({
  user,
  onLogout,
}: {
  user: DashboardUser;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const isStudent = pathname.startsWith("/student");
  const links = getPortalLinks(pathname);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuItems = [
    { label: "View Profile", href: links.profile, icon: User },
    ...(isStudent && links.fees
      ? [{ label: "Pay Fees", href: links.fees, icon: CreditCard }]
      : []),
    { label: "Support Ticket", href: links.support, icon: LifeBuoy },
    { label: "Change Password", href: links.password, icon: KeyRound },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className={cn(
          "flex items-center gap-2 rounded-full p-0.5 transition-all",
          "hover:ring-2 hover:ring-[#16a34a]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]/40",
          open && "ring-2 ring-[#16a34a]/40"
        )}
      >
        <UserAvatar
          user={user}
          sizeClass="h-9 w-9"
          borderClass="border-2 border-[#002147]/15"
        />
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 text-[#002147]/70 transition-transform sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#18181b] text-white shadow-2xl"
          >
            <div className="border-b border-white/10 bg-[#1e1e1e] p-4">
              <div className="flex items-center gap-3 rounded-xl border-l-4 border-[#16a34a] bg-white/[0.04] py-2.5 pl-3 pr-2">
                <UserAvatar
                  user={user}
                  sizeClass="h-11 w-11"
                  borderClass="border-2 border-white/15"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold uppercase tracking-wide text-white">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {user.email ?? user.id}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/5 hover:text-[#F68F3A]"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                  {item.label}
                </Link>
              ))}

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserProfileCard({
  user,
  collapsed,
}: {
  user: DashboardUser;
  collapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-2 rounded-xl border border-white/10 bg-white/5 p-3",
        collapsed && "flex justify-center p-2"
      )}
    >
      <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
        <UserAvatar
          user={user}
          sizeClass="h-10 w-10"
          borderClass="border-2 border-white/40 ring-2 ring-[#F68F3A]/35"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-white/55">
              {user.email ?? user.id}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SidebarNavProps {
  items: SidebarItem[];
  collapsed?: boolean;
  activeClasses: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
  onNavigate?: () => void;
}

function SidebarNav({
  items,
  collapsed = false,
  activeClasses,
  openGroups,
  onToggleGroup,
  onNavigate,
}: SidebarNavProps) {
  const location = useLocation();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        if (item.children?.length) {
          const groupActive = isGroupActive(item, location.pathname);
          const expanded = Boolean(openGroups[item.label]) || groupActive;

          return (
            <div key={item.label}>
              <button
                type="button"
                title={collapsed ? item.label : undefined}
                onClick={() => onToggleGroup(item.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                  collapsed && "justify-center px-2",
                  groupActive && "bg-white/10 text-white"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        expanded && "rotate-180"
                      )}
                    />
                  </>
                )}
              </button>
              <AnimatePresence initial={false}>
                {expanded && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.href}
                          to={child.href}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              "block rounded-lg px-3 py-2 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white",
                              isActive && activeClasses
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {collapsed &&
                expanded &&
                item.children.map((child) => (
                  <NavLink
                    key={child.href}
                    to={child.href}
                    title={child.label}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "mt-1 flex items-center justify-center rounded-xl px-2 py-2 text-white/60 hover:bg-white/10 hover:text-white",
                        isActive && activeClasses
                      )
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
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
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-2",
                isActive && activeClasses
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="truncate overflow-hidden whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function DashboardLayout({
  sidebarItems,
  loginPath,
  activeAccent = "green",
  user = DEFAULT_STUDENT,
}: DashboardLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const {
    accentColor,
    sidebarVariant,
    navbarStyle,
    sidebarCollapsible,
    isSidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    contentContainerClass,
  } = useLayout();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();

  const collapsed =
    sidebarCollapsible === "Icon" ? isSidebarCollapsed : false;
  const offCanvasHidden =
    sidebarCollapsible === "OffCanvas" && isSidebarCollapsed;

  const activeClasses = useMemo(
    () =>
      cn(
        "text-white shadow-lg hover:text-white",
        "bg-[var(--portal-accent)] hover:bg-[var(--portal-accent)]",
        "shadow-[0_10px_24px_-8px_var(--portal-accent)]"
      ),
    []
  );

  // Preserve portal accent fallback when layout preset is Default + admin orange
  useEffect(() => {
    if (activeAccent === "orange" && accentColor === THEME_PRESET_COLORS.Default) {
      document.documentElement.style.setProperty("--portal-accent", "#ea580c");
    }
  }, [activeAccent, accentColor]);

  const flatLinks = useMemo(() => flattenNav(sidebarItems), [sidebarItems]);

  const pageTitle = useMemo(() => {
    const match = flatLinks.find(
      (item) =>
        location.pathname === item.href ||
        location.pathname.startsWith(`${item.href}/`)
    );
    return match?.label ?? "Dashboard";
  }, [location.pathname, flatLinks]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    sidebarItems.forEach((item) => {
      if (item.children && isGroupActive(item, location.pathname)) {
        next[item.label] = true;
      }
    });
    if (Object.keys(next).length) {
      setOpenGroups((prev) => ({ ...prev, ...next }));
    }
  }, [location.pathname, sidebarItems]);

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate(loginPath);
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const shellPadding =
    sidebarVariant === "Inset" || sidebarVariant === "Floating"
      ? "p-3 md:p-4"
      : "p-0";

  const sidebarSurface = cn(
    "relative flex-col bg-[#002147] text-white transition-all duration-300 ease-in-out",
    sidebarVariant === "Floating" &&
      "rounded-2xl border border-white/10 shadow-2xl shadow-black/30",
    sidebarVariant === "Inset" && "rounded-2xl border border-white/10"
  );

  return (
    <AvatarProvider defaultUrl={user.avatarUrl || PROFILE_PHOTO}>
    <div
      className={cn(
        "dashboard-shell flex min-h-screen bg-[#F4F7FB] transition-colors duration-300 dark:bg-[#0b1220]",
        shellPadding
      )}
      style={{ ["--portal-accent" as string]: accentColor }}
    >
      <aside
        className={cn(
          sidebarSurface,
          "hidden shrink-0 lg:flex",
          offCanvasHidden && "lg:hidden",
          !offCanvasHidden && (collapsed ? "w-[80px]" : "w-[270px]")
        )}
      >
        <SidebarBrandHeader collapsed={collapsed} />

        <SidebarNav
          items={sidebarItems}
          collapsed={collapsed}
          activeClasses={activeClasses}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
        />

        <div className="border-t border-white/10 p-3">
          <UserProfileCard user={user} collapsed={collapsed} />
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-all duration-200 hover:bg-red-500/15 hover:text-red-300",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          className="absolute -right-3 top-20 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#002147]/15 bg-white text-[#002147] shadow-md transition-transform hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label={
            isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
        >
          {isSidebarCollapsed || collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#002147]/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#002147] text-white shadow-2xl lg:hidden"
            >
              <SidebarBrandHeader
                onNavigate={() => setMobileOpen(false)}
                trailing={
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="shrink-0 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                }
              />

              <SidebarNav
                items={sidebarItems}
                activeClasses={activeClasses}
                openGroups={openGroups}
                onToggleGroup={toggleGroup}
                onNavigate={() => setMobileOpen(false)}
              />

              <div className="border-t border-white/10 p-3">
                <UserProfileCard user={user} />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-red-500/15 hover:text-red-300"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300",
          (sidebarVariant === "Inset" || sidebarVariant === "Floating") &&
            "rounded-2xl border border-[#E5EBF3] bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60",
          sidebarVariant === "Sidebar" && "bg-transparent"
        )}
      >
        <header
          className={cn(
            "z-40 flex h-16 items-center gap-3 border-b border-[#E5EBF3] bg-white/95 px-4 backdrop-blur-md transition-colors md:px-6 dark:border-slate-800 dark:bg-slate-900/90",
            navbarStyle === "Sticky" ? "sticky top-0" : "relative"
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (offCanvasHidden) {
                setSidebarCollapsed(false);
                return;
              }
              setMobileOpen(true);
            }}
            className={cn(
              "rounded-xl p-2 text-[#002147] transition-colors hover:bg-[#F4F7FB] dark:text-slate-100 dark:hover:bg-slate-800",
              !offCanvasHidden && "lg:hidden"
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/"
            title="Dhapti University — public site"
            className="hidden shrink-0 sm:block"
          >
            <BrandLogo />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-[#002147] md:text-lg dark:text-slate-100">
              {pageTitle}
            </h1>
          </div>

          <div className="relative hidden max-w-xs flex-1 md:block lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search portal..."
              className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9 transition-all focus-visible:ring-[color:var(--portal-accent)]/30 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <Link
              to="/"
              title="View Public Website"
              aria-label="View Public Website"
              className="rounded-xl p-2.5 text-[#002147] transition-colors hover:bg-[#F4F7FB] dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Home className="h-5 w-5" />
            </Link>

            <NotificationBell accentColor={accentColor} />

            <LayoutSettingsPopover />

            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "rounded-xl p-2.5 text-[#002147] transition-colors hover:bg-[#F4F7FB] dark:text-slate-100 dark:hover:bg-slate-800",
                theme === "dark" && "bg-[#002147] text-white hover:bg-[#003366] dark:bg-slate-100 dark:text-[#002147] dark:hover:bg-white"
              )}
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              title="Theme toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            <div className="ml-1">
              <TopbarProfileMenu user={user} onLogout={handleLogout} />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className={cn("layout-content-width", contentContainerClass)}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
    </AvatarProvider>
  );
}

function profileUser(
  fallback: DashboardUser,
  profile: Record<string, unknown> | null | undefined,
  email?: string
): DashboardUser {
  if (!profile) return fallback;
  return {
    name: String(profile.fullName || fallback.name),
    id: String(
      profile.studentCode || profile.facultyCode || fallback.id
    ),
    email: email || String(profile.email || fallback.email),
    role: fallback.role,
    avatarUrl:
      typeof profile.profilePhoto === "string" && profile.profilePhoto
        ? profile.profilePhoto
        : fallback.avatarUrl,
  };
}

export function StudentDashboardLayout() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      portalName="Student Portal"
      loginPath="/student/login"
      sidebarItems={studentNavItems}
      user={profileUser(DEFAULT_STUDENT, user?.profile, user?.email)}
    />
  );
}

export function TeacherDashboardLayout() {
  const { user } = useAuth();
  return (
    <DashboardLayout
      portalName="Faculty Portal"
      loginPath="/teacher/login"
      sidebarItems={teacherNavItems}
      user={profileUser(DEFAULT_TEACHER, user?.profile, user?.email)}
    />
  );
}

const DEPARTMENT_ADMIN_NAV_HREFS = new Set([
  "/admin/department-dashboard",
  "/admin/students",
  "/admin/teachers",
  "/admin/classes",
  "/admin/certificates",
  "/admin/attendance-locations",
  "/admin/notifications",
]);

const EXAM_ADMIN_NAV_HREFS = new Set([
  "/admin/exam-control",
  "/admin/course-results",
  "/admin/grades",
  "/admin/notifications",
]);

const CERTIFICATE_ADMIN_NAV_HREFS = new Set([
  "/admin/certificates",
  "/admin/students",
  "/admin/notifications",
]);

function filterAdminNavForRole(
  items: SidebarItem[],
  role: string | undefined
): SidebarItem[] {
  if (role === "EXAM_ADMIN") {
    return items
      .filter((item) => {
        if (item.children) return false;
        return item.href ? EXAM_ADMIN_NAV_HREFS.has(item.href) : false;
      })
      .map((item) =>
        item.href === "/admin/exam-control"
          ? { ...item, label: "Exam Control" }
          : item
      );
  }
  if (role === "CERTIFICATE_ADMIN") {
    return items.filter((item) => {
      if (item.children) return false;
      return item.href ? CERTIFICATE_ADMIN_NAV_HREFS.has(item.href) : false;
    });
  }
  if (role !== "DEPARTMENT_ADMIN") {
    return items.filter((item) => item.href !== "/admin/department-dashboard");
  }
  return items
    .filter((item) => {
      if (item.children) return false;
      return item.href ? DEPARTMENT_ADMIN_NAV_HREFS.has(item.href) : false;
    })
    .map((item) =>
      item.href === "/admin/department-dashboard"
        ? { ...item, label: "Dashboard" }
        : item
    );
}

export function AdminDashboardLayout() {
  const { user } = useAuth();
  const sidebarItems = filterAdminNavForRole(adminNavItems, user?.role);
  return (
    <DashboardLayout
      portalName={
        user?.role === "DEPARTMENT_ADMIN"
          ? "Department Admin Portal"
          : user?.role === "EXAM_ADMIN"
            ? "Exam Control Portal"
            : user?.role === "CERTIFICATE_ADMIN"
              ? "Certificate Admin Portal"
              : "Admin Portal"
      }
      loginPath="/admin/login"
      sidebarItems={sidebarItems}
      activeAccent="orange"
      user={profileUser(DEFAULT_ADMIN, user?.profile, user?.email)}
    />
  );
}
