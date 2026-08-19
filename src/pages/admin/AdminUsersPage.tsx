import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Ban,
  KeyRound,
  Pencil,
  Plus,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type SystemRole = "ADMIN" | "TEACHER" | "STUDENT";
type UiStatus = "Active" | "Suspended" | "Inactive" | "Graduated";

interface SystemUser {
  id: string;
  email: string;
  role: SystemRole;
  status: UiStatus;
  statusCode: string;
  fullName: string;
  createdAt: string;
  profile: {
    type: SystemRole;
    id: string;
    code?: string;
    facultyId?: string | null;
    departmentId?: string | null;
  } | null;
}

interface ListResponse {
  data: SystemUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface FacultyOption {
  id: string;
  name: string;
  code: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  facultyId: string;
}

const selectTriggerClass =
  "border-[#E5EBF3] bg-white text-[#002147] dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]";
const fieldClass =
  "h-10 rounded-xl border-[#E5EBF3] bg-white text-sm font-semibold text-[#002147] placeholder:font-medium placeholder:text-slate-600 dark:border-[#E5EBF3] dark:bg-white dark:text-[#002147]";
const labelClass = "text-xs font-bold uppercase tracking-wide text-[#002147]";

const headerRowClass =
  "border-b border-slate-700/50 bg-[#002147]/80 hover:bg-[#002147]/80 dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:bg-slate-800/80";
const headerCellClass =
  "h-11 px-3 text-left align-middle text-xs font-black uppercase tracking-wider text-slate-200 whitespace-nowrap";

/** Prestigious display names for known / demo accounts */
const EMAIL_DISPLAY_NAMES: Record<string, string> = {
  "admin@dhapti.edu.so": "Admin User",
  "faculty@dhapti.edu.so": "Prof. Mohamed Hassan",
  "mohamed.ali@dhapti.edu.so": "Prof. Mohamed Hassan",
  "mohamudcade143@gmail.com": "Mohamud Mohamed Abas",
};

const EMAIL_DISPLAY_EMAILS: Record<string, string> = {
  "mohamed.ali@dhapti.edu.so": "faculty@dhapti.edu.so",
};

function displayName(user: SystemUser): string {
  const emailKey = user.email.toLowerCase();
  if (EMAIL_DISPLAY_NAMES[emailKey]) return EMAIL_DISPLAY_NAMES[emailKey];

  const raw = user.fullName.trim();
  if (/^users api\s+/i.test(raw)) {
    if (user.role === "ADMIN") return "Admin User";
    if (user.role === "TEACHER") return "Prof. Mohamed Hassan";
    if (user.role === "STUDENT") return "Mohamud Mohamed Abas";
  }
  return raw || user.email;
}

function displayEmail(user: SystemUser): string {
  const emailKey = user.email.toLowerCase();
  return EMAIL_DISPLAY_EMAILS[emailKey] ?? user.email;
}

function roleBadgeClass(role: SystemRole) {
  if (role === "ADMIN") return "bg-red-600 text-white hover:bg-red-600";
  if (role === "TEACHER") return "bg-[#ea580c] text-white hover:bg-[#ea580c]";
  return "bg-[#16a34a] text-white hover:bg-[#16a34a]";
}

function statusBadgeVariant(
  status: UiStatus
): "success" | "danger" | "secondary" | "outline" {
  if (status === "Active") return "success";
  if (status === "Suspended") return "danger";
  if (status === "Graduated") return "secondary";
  return "outline";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function userCode(user: SystemUser) {
  return user.profile?.code || user.id.slice(0, 12).toUpperCase();
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<
    DepartmentOption[]
  >([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    role: "STUDENT" as SystemRole,
    password: "DHAPTI@2026",
    facultyId: "",
    departmentId: "",
  });

  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    facultyId: "",
    departmentId: "",
  });

  const [resetUser, setResetUser] = useState<SystemUser | null>(null);
  const [resetPassword, setResetPassword] = useState("DHAPTI@2026");
  const [resetting, setResetting] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [faculties, departments] = await Promise.all([
          api<{ data: FacultyOption[] }>("/faculties?page=1&pageSize=100"),
          api<{ data: DepartmentOption[] }>("/departments?page=1&pageSize=100"),
        ]);
        if (!cancelled) {
          setFacultyOptions(faculties.data ?? []);
          setDepartmentOptions(departments.data ?? []);
        }
      } catch {
        /* optional for forms */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (roleFilter !== "ALL") params.set("role", roleFilter);

      const res = await api<ListResponse>(`/admin/users?${params}`);
      setUsers(res.data);
      setPagination((prev) => ({
        ...prev,
        ...res.pagination,
      }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load users";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, pagination.page, pagination.pageSize, roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [debouncedQ, roleFilter]);

  const createDepartments = useMemo(() => {
    if (!createForm.facultyId) return departmentOptions;
    return departmentOptions.filter((d) => d.facultyId === createForm.facultyId);
  }, [createForm.facultyId, departmentOptions]);

  const editDepartments = useMemo(() => {
    if (!editForm.facultyId) return departmentOptions;
    return departmentOptions.filter((d) => d.facultyId === editForm.facultyId);
  }, [editForm.facultyId, departmentOptions]);

  const needsAcademic =
    createForm.role === "STUDENT" || createForm.role === "TEACHER";

  function openCreate() {
    setCreateForm({
      fullName: "",
      email: "",
      role: "STUDENT",
      password: "DHAPTI@2026",
      facultyId: "",
      departmentId: "",
    });
    setCreateOpen(true);
  }

  function openEdit(user: SystemUser) {
    const departmentId = user.profile?.departmentId ?? "";
    const facultyFromDept =
      departmentOptions.find((d) => d.id === departmentId)?.facultyId ?? "";
    setEditUser(user);
    setEditForm({
      fullName: displayName(user),
      email: user.email,
      facultyId: user.profile?.facultyId ?? facultyFromDept,
      departmentId,
    });
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const body: Record<string, string> = {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        password: createForm.password.trim() || "DHAPTI@2026",
      };
      if (needsAcademic) {
        if (createForm.facultyId) body.facultyId = createForm.facultyId;
        if (createForm.departmentId) body.departmentId = createForm.departmentId;
      }

      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(`New ${createForm.role} account created successfully!`);
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to create user"
      );
    } finally {
      setCreating(false);
    }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditing(true);
    try {
      const body: Record<string, string | null> = {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
      };
      if (editUser.role === "STUDENT" || editUser.role === "TEACHER") {
        body.facultyId = editForm.facultyId || null;
        body.departmentId = editForm.departmentId || null;
      }
      await api(`/admin/users/${editUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("User updated successfully");
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update user"
      );
    } finally {
      setEditing(false);
    }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    setResetting(true);
    try {
      await api(`/admin/users/${resetUser.id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword.trim() }),
      });
      toast.success(`Password reset for ${displayName(resetUser)}`);
      setResetUser(null);
      setResetPassword("DHAPTI@2026");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to reset password"
      );
    } finally {
      setResetting(false);
    }
  }

  async function toggleStatus(user: SystemUser) {
    setStatusBusyId(user.id);
    try {
      const next = user.status === "Active" ? "SUSPENDED" : "ACTIVE";
      await api(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      const name = displayName(user);
      toast.success(
        next === "SUSPENDED" ? `${name} suspended` : `${name} reactivated`
      );
      await loadUsers();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update status"
      );
    } finally {
      setStatusBusyId(null);
    }
  }

  const actionBtnClass =
    "h-8 w-8 shrink-0 rounded-lg border border-[#E5EBF3] bg-white p-0 text-[#002147] hover:bg-[#F4F7FB] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] md:text-3xl dark:text-slate-100">
            User Management
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create accounts, assign roles, reset passwords, and manage access
            status across the Dhapti system.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
        >
          <Plus className="h-4 w-4" />
          Create New User
        </Button>
      </div>

      <Card className="border-[#E5EBF3]">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className={cn(fieldClass, "pl-9")}
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger
              className={cn(selectTriggerClass, "h-10 w-full md:w-48")}
            >
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admins</SelectItem>
              <SelectItem value="TEACHER">Teachers</SelectItem>
              <SelectItem value="STUDENT">Students</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-[#E5EBF3]">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={8} columns={7} />
            </div>
          ) : error ? (
            <EmptyState
              title="Unable to load users"
              description={error}
              action={
                <Button variant="outline" onClick={() => void loadUsers()}>
                  Retry
                </Button>
              }
            />
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description="Try adjusting search or role filters, or create a new user."
              action={
                <Button
                  className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
                  onClick={openCreate}
                >
                  Create New User
                </Button>
              }
            />
          ) : (
            <div className="users-mgmt-table w-full overflow-x-auto">
              <Table className="min-w-[880px] table-fixed">
                <TableHeader>
                  <TableRow className={headerRowClass}>
                    <TableHead className={cn(headerCellClass, "w-[14%] pl-4")}>
                      User ID
                    </TableHead>
                    <TableHead className={cn(headerCellClass, "w-[18%]")}>
                      Name
                    </TableHead>
                    <TableHead className={cn(headerCellClass, "w-[22%]")}>
                      Email
                    </TableHead>
                    <TableHead className={cn(headerCellClass, "w-[10%]")}>
                      Role
                    </TableHead>
                    <TableHead className={cn(headerCellClass, "w-[10%]")}>
                      Status
                    </TableHead>
                    <TableHead className={cn(headerCellClass, "w-[12%]")}>
                      Created Date
                    </TableHead>
                    <TableHead
                      className={cn(headerCellClass, "w-[14%] pr-4 text-right")}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-b border-[#E5EBF3]">
                      <TableCell className="users-mgmt-id whitespace-nowrap px-3 py-3 pl-4 font-mono text-xs font-bold text-[#002147] dark:text-slate-200">
                        {userCode(user)}
                      </TableCell>
                      <TableCell className="truncate px-3 py-3 text-sm font-bold text-[#002147] dark:text-slate-100">
                        {displayName(user)}
                      </TableCell>
                      <TableCell className="truncate px-3 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {displayEmail(user)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3">
                        <Badge className={roleBadgeClass(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3">
                        <Badge variant={statusBadgeVariant(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-3 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Reset Password"
                            aria-label={`Reset password for ${displayName(user)}`}
                            className={actionBtnClass}
                            onClick={() => {
                              setResetPassword("DHAPTI@2026");
                              setResetUser(user);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Edit User"
                            aria-label={`Edit ${displayName(user)}`}
                            className={actionBtnClass}
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title={
                              user.status === "Active"
                                ? "Suspend User"
                                : "Activate User"
                            }
                            aria-label={
                              user.status === "Active"
                                ? `Suspend ${displayName(user)}`
                                : `Activate ${displayName(user)}`
                            }
                            disabled={statusBusyId === user.id}
                            className={cn(
                              actionBtnClass,
                              user.status === "Active"
                                ? "text-red-700 hover:text-red-800"
                                : "text-[#16a34a] hover:text-[#15803d]"
                            )}
                            onClick={() => void toggleStatus(user)}
                          >
                            {user.status === "Active" ? (
                              <Ban className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && users.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Showing page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} users
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
              }
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination((p) => ({
                  ...p,
                  page: Math.min(p.totalPages, p.page + 1),
                }))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create User */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Assign a role and initial password. Student and Teacher accounts
              also create the matching profile record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <label className="block space-y-1.5">
              <span className={labelClass}>Full Name</span>
              <Input
                required
                value={createForm.fullName}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, fullName: e.target.value }))
                }
                className={fieldClass}
                placeholder="e.g. Ahmed Mohamed Ali"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>Email Address</span>
              <Input
                required
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
                className={fieldClass}
                placeholder="name@dhapti.edu.so"
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>Role</span>
              <Select
                value={createForm.role}
                onValueChange={(role) =>
                  setCreateForm((f) => ({
                    ...f,
                    role: role as SystemRole,
                    facultyId: role === "ADMIN" ? "" : f.facultyId,
                    departmentId: role === "ADMIN" ? "" : f.departmentId,
                  }))
                }
              >
                <SelectTrigger className={cn(selectTriggerClass, "h-10")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">STUDENT</SelectItem>
                  <SelectItem value="TEACHER">TEACHER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>Assign Password</span>
              <Input
                required
                minLength={6}
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
                className={fieldClass}
                placeholder="DHAPTI@2026"
              />
            </label>

            {needsAcademic && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className={labelClass}>Faculty</span>
                  <Select
                    value={createForm.facultyId || "none"}
                    onValueChange={(value) =>
                      setCreateForm((f) => ({
                        ...f,
                        facultyId: value === "none" ? "" : value,
                        departmentId: "",
                      }))
                    }
                  >
                    <SelectTrigger className={cn(selectTriggerClass, "h-10")}>
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not assigned</SelectItem>
                      {facultyOptions.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className={labelClass}>Department</span>
                  <Select
                    value={createForm.departmentId || "none"}
                    onValueChange={(value) =>
                      setCreateForm((f) => ({
                        ...f,
                        departmentId: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className={cn(selectTriggerClass, "h-10")}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not assigned</SelectItem>
                      {createDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-[#ea580c] text-white hover:bg-[#c2410c]"
              >
                {creating ? "Creating…" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update profile details for{" "}
              <span className="font-bold text-[#002147]">
                {editUser ? displayName(editUser) : ""}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className={labelClass}>Full Name</span>
              <Input
                required
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, fullName: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClass}>Email Address</span>
              <Input
                required
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            {editUser &&
              (editUser.role === "STUDENT" || editUser.role === "TEACHER") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className={labelClass}>Faculty</span>
                    <Select
                      value={editForm.facultyId || "none"}
                      onValueChange={(value) =>
                        setEditForm((f) => ({
                          ...f,
                          facultyId: value === "none" ? "" : value,
                          departmentId: "",
                        }))
                      }
                    >
                      <SelectTrigger className={cn(selectTriggerClass, "h-10")}>
                        <SelectValue placeholder="Select faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {facultyOptions.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className={labelClass}>Department</span>
                    <Select
                      value={editForm.departmentId || "none"}
                      onValueChange={(value) =>
                        setEditForm((f) => ({
                          ...f,
                          departmentId: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger className={cn(selectTriggerClass, "h-10")}>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {editDepartments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
              )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUser(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editing}
                className="bg-[#002147] text-white hover:bg-[#003366]"
              >
                {editing ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password */}
      <Dialog
        open={!!resetUser}
        onOpenChange={(open) => {
          if (!open) setResetUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-bold text-[#002147]">
                {resetUser ? displayName(resetUser) : ""}
              </span>{" "}
              ({resetUser ? displayEmail(resetUser) : ""}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReset} className="space-y-4">
            <label className="block space-y-1.5">
              <span className={labelClass}>New Password</span>
              <Input
                required
                minLength={6}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className={fieldClass}
                placeholder="DHAPTI@2026"
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetUser(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={resetting}
                className="bg-[#002147] text-white hover:bg-[#003366]"
              >
                <KeyRound className="h-4 w-4" />
                {resetting ? "Saving…" : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
