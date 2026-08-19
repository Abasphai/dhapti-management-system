import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Send } from "lucide-react";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import {
  formatNotificationTime,
  priorityBadgeVariant,
  type PaginationMeta,
  type SentNotification,
} from "@/lib/notifications";
import { NotificationsInboxPage } from "@/pages/shared/NotificationsInboxPage";

type Tab = "compose" | "sent" | "inbox";

type Audience =
  | "STUDENTS"
  | "TEACHERS"
  | "ADMINS"
  | "STUDENTS_TEACHERS"
  | "EVERYONE"
  | "USERS";

export function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>("compose");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {tab !== "inbox" && (
        <PageHeader
          title="Notifications"
          description="Send announcements and review delivery status."
        />
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["compose", "Compose"],
            ["sent", "Sent"],
            ["inbox", "My inbox"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "compose" && <ComposePanel onSent={() => setTab("sent")} />}
      {tab === "sent" && <SentPanel />}
      {tab === "inbox" && (
        <NotificationsInboxPage
          title="My inbox"
          description="Notifications addressed to your admin account."
        />
      )}
    </div>
  );
}

function ComposePanel({ onSent }: { onSent: () => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [priority, setPriority] = useState("NORMAL");
  const [audience, setAudience] = useState<Audience>("STUDENTS");
  const [userIdsText, setUserIdsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const userIds =
        audience === "USERS"
          ? userIdsText
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;

      const res = await api<{ id: string; recipientCount: number }>(
        "/notifications",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            message,
            type,
            priority,
            audience,
            ...(userIds ? { userIds } : {}),
          }),
        }
      );
      setSuccess(
        `Notification sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? "" : "s"}.`
      );
      setTitle("");
      setMessage("");
      setUserIdsText("");
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
      onSent();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to send notification"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-[#E5EBF3]">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Megaphone className="h-5 w-5 text-[#002147]" />
        <h2 className="text-base font-bold text-[#002147]">New announcement</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#002147]">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder="Midterm Examination Schedule"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#002147]">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              maxLength={5000}
              placeholder="Midterm examinations will begin on…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#002147]">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                  <SelectItem value="SYSTEM">System</SelectItem>
                  <SelectItem value="ACADEMIC">Academic</SelectItem>
                  <SelectItem value="SECURITY">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#002147]">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#002147]">
                Audience
              </label>
              <Select
                value={audience}
                onValueChange={(v) => setAudience(v as Audience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENTS">All students</SelectItem>
                  <SelectItem value="TEACHERS">All teachers</SelectItem>
                  <SelectItem value="ADMINS">All admins</SelectItem>
                  <SelectItem value="STUDENTS_TEACHERS">
                    Students + teachers
                  </SelectItem>
                  <SelectItem value="EVERYONE">Everyone</SelectItem>
                  <SelectItem value="USERS">Specific users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {audience === "USERS" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#002147]">
                User IDs (comma-separated)
              </label>
              <Input
                value={userIdsText}
                onChange={(e) => setUserIdsText(e.target.value)}
                placeholder="cuid1, cuid2"
                required
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send notification
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SentPanel() {
  const [rows, setRows] = useState<SentNotification[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "15",
      });
      if (q.trim()) params.set("q", q.trim());
      if (type !== "ALL") params.set("type", type);
      if (priority !== "ALL") params.set("priority", priority);

      const res = await api<{
        data: SentNotification[];
        pagination: PaginationMeta;
      }>(`/notifications/sent?${params}`);
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load sent notifications"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q, type, priority]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search title or message…"
          className="max-w-xs"
        />
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
            <SelectItem value="SYSTEM">System</SelectItem>
            <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
            <SelectItem value="GRADE">Grade</SelectItem>
            <SelectItem value="QUIZ">Quiz</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(v) => {
            setPriority(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No sent notifications found.
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="border-[#E5EBF3]">
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#002147]">{row.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {row.message}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{row.type}</Badge>
                    <Badge variant={priorityBadgeVariant(row.priority)}>
                      {row.priority}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{formatNotificationTime(row.createdAt)}</span>
                  <span>
                    Recipients: {row.recipientCount}
                    {row.readCount != null ? ` · Read: ${row.readCount}` : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
