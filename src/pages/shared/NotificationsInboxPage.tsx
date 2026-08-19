import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellOff, CheckCheck, Loader2 } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/TableSkeleton";
import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  type InboxNotification,
  type PaginationMeta,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

type UnreadFilter = "all" | "unread" | "read";

interface Props {
  title?: string;
  description?: string;
}

export function NotificationsInboxPage({
  title = "Notifications",
  description = "Your in-app alerts and announcements.",
}: Props) {
  const [rows, setRows] = useState<InboxNotification[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [unreadFilter, setUnreadFilter] = useState<UnreadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxNotification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "15",
      });
      if (unreadFilter === "unread") params.set("unread", "true");
      if (unreadFilter === "read") params.set("unread", "false");
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const res = await api<{
        data: InboxNotification[];
        pagination: PaginationMeta;
      }>(`/notifications?${params}`);
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load notifications"
      );
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [page, unreadFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(item: InboxNotification) {
    if (item.read) {
      setSelected(item);
      return;
    }
    try {
      const updated = await api<InboxNotification>(
        `/notifications/${item.id}/read`,
        { method: "PATCH" }
      );
      setRows((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, ...updated } : r))
      );
      setSelected(updated);
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to mark as read"
      );
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError(null);
    try {
      await api<{ updated: number }>("/notifications/read-all", {
        method: "POST",
      });
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to mark all as read"
      );
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadHint =
    pagination && unreadFilter === "unread"
      ? `You have ${pagination.total} unread notification${pagination.total === 1 ? "" : "s"}.`
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={unreadFilter}
          onValueChange={(v) => {
            setUnreadFilter(v as UnreadFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
            <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
            <SelectItem value="GRADE">Grade</SelectItem>
            <SelectItem value="QUIZ">Quiz</SelectItem>
            <SelectItem value="SYSTEM">System</SelectItem>
            <SelectItem value="ATTENDANCE">Attendance</SelectItem>
            <SelectItem value="ACADEMIC">Academic</SelectItem>
            <SelectItem value="SECURITY">Security</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={markingAll || loading}
          onClick={() => void markAllRead()}
          className="ml-auto"
        >
          {markingAll ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-2 h-4 w-4" />
          )}
          Mark all as read
        </Button>
      </div>

      {unreadHint && (
        <p className="text-sm font-medium text-[#002147] dark:text-slate-100">
          {unreadHint}
        </p>
      )}

      {loading && <ListSkeleton count={5} />}

      {!loading && error && (
        <Card className="border-red-200">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={BellOff}
          title={
            unreadFilter === "unread"
              ? "No Unseen Notifications"
              : "No Notifications"
          }
          description={
            unreadFilter === "unread"
              ? "You’re fully caught up — no unread alerts in your inbox."
              : "University announcements and academic alerts will show up here."
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            {rows.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void markRead(item)}
                className={cn(
                  "w-full rounded-xl border border-[#E5EBF3] bg-white p-4 text-left transition-colors hover:bg-[#F4F7FB] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                  !item.read && "border-l-4 border-l-[color:var(--portal-accent)]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-sm text-[#002147] dark:text-slate-100",
                          !item.read ? "font-bold" : "font-semibold"
                        )}
                      >
                        {item.title}
                      </p>
                      {!item.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--portal-accent)]" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={priorityBadgeVariant(item.priority)}>
                      {item.priority}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatNotificationTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
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

          <Card className="border-[#E5EBF3] h-fit">
            <CardContent className="space-y-3 p-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Select a notification to view details.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{selected.type}</Badge>
                    <Badge variant={priorityBadgeVariant(selected.priority)}>
                      {selected.priority}
                    </Badge>
                    <Badge variant={selected.read ? "secondary" : "info"}>
                      {selected.read ? "Read" : "Unread"}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-[#002147] dark:text-slate-100">
                    {selected.title}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {selected.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNotificationTime(selected.createdAt)}
                  </p>
                  {selected.link && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={selected.link}>View related</Link>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
