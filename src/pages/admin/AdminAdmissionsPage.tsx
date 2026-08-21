import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Eye, Search, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";

type ApiStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "INTERVIEW_SCHEDULED"
  | "APPROVED"
  | "REJECTED";

type AdmissionStatus =
  | "New"
  | "Under Review"
  | "Interview Scheduled"
  | "Approved"
  | "Rejected";

interface Application {
  id: string;
  trackingCode: string;
  name: string;
  email: string;
  faculty: string;
  facultyId: string | null;
  date: string;
  status: AdmissionStatus;
  apiStatus: ApiStatus;
  phone: string;
  highSchoolGPA: number | null;
  program: string | null;
  documentsUrl: string | null;
  rejectionReason: string | null;
  studentCode: string | null;
}

type ApiApplication = {
  id: string;
  trackingCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  facultyId: string | null;
  highSchoolGPA: number | null;
  documentsUrl: string | null;
  status: ApiStatus;
  rejectionReason: string | null;
  createdAt: string;
  faculty: { id: string; name: string; code: string } | null;
  program: { id: string; code: string; title: string } | null;
  student: { studentCode: string } | null;
};

const statusVariant: Record<
  AdmissionStatus,
  "info" | "warning" | "secondary" | "success" | "danger"
> = {
  New: "info",
  "Under Review": "warning",
  "Interview Scheduled": "secondary",
  Approved: "success",
  Rejected: "danger",
};

function mapStatus(status: ApiStatus): AdmissionStatus {
  switch (status) {
    case "PENDING":
      return "New";
    case "UNDER_REVIEW":
      return "Under Review";
    case "INTERVIEW_SCHEDULED":
      return "Interview Scheduled";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
  }
}

function mapApplication(row: ApiApplication): Application {
  return {
    id: row.id,
    trackingCode: row.trackingCode,
    name: row.fullName,
    email: row.email,
    faculty: row.faculty?.name ?? "—",
    facultyId: row.facultyId,
    date: new Date(row.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    status: mapStatus(row.status),
    apiStatus: row.status,
    phone: row.phone ?? "—",
    highSchoolGPA: row.highSchoolGPA,
    program: row.program ? `${row.program.code} — ${row.program.title}` : null,
    documentsUrl: row.documentsUrl,
    rejectionReason: row.rejectionReason,
    studentCode: row.student?.studentCode ?? null,
  };
}

export function AdminAdmissionsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [counts, setCounts] = useState({
    PENDING: 0,
    UNDER_REVIEW: 0,
    INTERVIEW_SCHEDULED: 0,
    APPROVED: 0,
    REJECTED: 0,
  });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [review, setReview] = useState<Application | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (query.trim()) params.set("search", query.trim());
      const res = await api<{
        data: ApiApplication[];
        counts: typeof counts;
      }>(`/admin/admissions?${params}`);
      setApplications(res.data.map(mapApplication));
      setCounts(res.counts);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load admissions"
      );
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const isFinal = (status: AdmissionStatus) =>
    status === "Approved" || status === "Rejected";

  const openReject = (app: Application) => {
    setRejectTarget(app);
    setRejectReason("");
    setRejectOpen(true);
  };

  const approve = async (app: Application) => {
    setBusyId(app.id);
    setActionMessage(null);
    try {
      const res = await api<{
        studentCode: string;
        message: string;
      }>(`/admin/admissions/${app.id}/approve`, { method: "POST" });
      setActionMessage(
        `${res.message}. Registration code: ${res.studentCode}`
      );
      toast.success("Student application approved & ID generated!");
      setReview(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    setActionMessage(null);
    try {
      await api(`/admin/admissions/${rejectTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setRejectOpen(false);
      setRejectTarget(null);
      setReview(null);
      setActionMessage("Application rejected");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const scheduleInterview = async (app: Application) => {
    setBusyId(app.id);
    setActionMessage(null);
    try {
      await api(`/admin/admissions/${app.id}/interview`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Admissions Queue"
        description="Review and process incoming online applications for the upcoming intake."
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {actionMessage && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {actionMessage}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["New", counts.PENDING],
            ["Under Review", counts.UNDER_REVIEW],
            ["Interview", counts.INTERVIEW_SCHEDULED],
            ["Approved", counts.APPROVED],
            ["Rejected", counts.REJECTED],
          ] as const
        ).map(([label, count]) => (
          <Card key={label} className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-[#002147] dark:text-slate-100">
                {count}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#E5EBF3] shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-[#E5EBF3] pb-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#002147] dark:text-slate-100">
                Incoming Online Applications
              </h2>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Loading applications…"
                  : `${applications.length} applications in the current intake queue`}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search applicants..."
                className="h-10 rounded-xl border-[#E5EBF3] bg-[#F4F7FB] pl-9 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-scroll">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-b border-slate-700/50 bg-[#002147]/80 hover:bg-[#002147]/80 dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="w-[28%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Applicant
                </TableHead>
                <TableHead className="w-[12%] whitespace-nowrap px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Date
                </TableHead>
                <TableHead className="w-[20%] px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Faculty
                </TableHead>
                <TableHead className="w-[14%] whitespace-nowrap px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Status
                </TableHead>
                <TableHead className="w-[16%] whitespace-nowrap px-3 text-right text-xs font-black uppercase tracking-wider text-slate-200">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow
                  key={app.id}
                  className="border-b border-slate-100 hover:bg-[#F4F7FB]/70 dark:border-slate-800 dark:hover:bg-slate-900/50"
                >
                  <TableCell className="max-w-0 px-3 py-3">
                    <p className="truncate text-sm font-bold text-[#002147] dark:text-slate-100">
                      {app.name}
                    </p>
                    <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {app.trackingCode}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-3 text-sm text-muted-foreground">
                    {app.date}
                  </TableCell>
                  <TableCell className="max-w-0 truncate px-3 py-3 text-sm text-muted-foreground">
                    {app.faculty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-3">
                    <Badge
                      variant={statusVariant[app.status]}
                      className="px-2.5 py-0.5 uppercase"
                    >
                      {app.apiStatus === "APPROVED"
                        ? "APPROVED"
                        : app.apiStatus === "REJECTED"
                          ? "REJECTED"
                          : app.apiStatus === "PENDING"
                            ? "PENDING"
                            : app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[#002147] hover:bg-[#002147]/10"
                        title="Review"
                        onClick={() => setReview(app)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[#16a34a] hover:bg-green-50"
                        title="Approve"
                        disabled={isFinal(app.status) || busyId === app.id}
                        onClick={() => void approve(app)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[#ea580c] hover:bg-orange-50"
                        title="Schedule interview"
                        disabled={
                          isFinal(app.status) ||
                          app.status === "Interview Scheduled" ||
                          busyId === app.id
                        }
                        onClick={() => void scheduleInterview(app)}
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                        title="Reject"
                        disabled={isFinal(app.status) || busyId === app.id}
                        onClick={() => openReject(app)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && applications.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No applications match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">Review Application</DialogTitle>
          </DialogHeader>
          {review && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-bold text-[#002147]">Tracking ID:</span>{" "}
                <span className="font-mono font-semibold">
                  {review.trackingCode}
                </span>
              </p>
              <p>
                <span className="font-bold text-[#002147]">Applicant:</span>{" "}
                {review.name}
              </p>
              <p>
                <span className="font-bold text-[#002147]">Email:</span>{" "}
                {review.email}
              </p>
              <p>
                <span className="font-bold text-[#002147]">Phone:</span>{" "}
                {review.phone}
              </p>
              <p>
                <span className="font-bold text-[#002147]">Intended faculty:</span>{" "}
                {review.faculty}
              </p>
              <p>
                <span className="font-bold text-[#002147]">Program:</span>{" "}
                {review.program ?? "—"}
              </p>
              <p>
                <span className="font-bold text-[#002147]">High school GPA:</span>{" "}
                {review.highSchoolGPA ?? "—"}
              </p>
              <p>
                <span className="font-bold text-[#002147]">Documents:</span>{" "}
                {review.documentsUrl ? (
                  <a
                    href={review.documentsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    Open link
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="font-bold text-[#002147]">Status:</span>{" "}
                <Badge variant={statusVariant[review.status]}>
                  {review.status}
                </Badge>
              </p>
              {review.studentCode && (
                <p>
                  <span className="font-bold text-[#002147]">Student code:</span>{" "}
                  {review.studentCode}
                </p>
              )}
              {review.rejectionReason && (
                <p>
                  <span className="font-bold text-[#002147]">Rejection reason:</span>{" "}
                  {review.rejectionReason}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setReview(null)}>
              Close
            </Button>
            {review && !isFinal(review.status) && (
              <>
                <Button
                  className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                  disabled={busyId === review.id}
                  onClick={() => void approve(review)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600"
                  disabled={busyId === review.id}
                  onClick={() => openReject(review)}
                >
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason" className="font-bold text-[#002147]">
              Reason
            </Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide a clear rejection reason"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 3 || !!busyId}
              onClick={() => void reject()}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
