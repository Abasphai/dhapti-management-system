import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Loader2 } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import {
  formatNotificationTime,
  type InboxNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

function viewAllPath(pathname: string) {
  if (pathname.startsWith("/admin")) return "/admin/notifications";
  if (pathname.startsWith("/teacher")) return "/teacher/notifications";
  return "/student/notifications";
}

export function NotificationBell({ accentColor }: { accentColor: string }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await api<{ count: number }>("/notifications/unread-count");
      setCount(res.count);
    } catch {
      /* ignore when logged out / network blip */
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: InboxNotification[] }>(
        "/notifications?unread=true&page=1&pageSize=5"
      );
      setItems(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load notifications"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const onChange = () => void refreshCount();
    window.addEventListener("dhapti-notifications-changed", onChange);
    const timer = window.setInterval(() => void refreshCount(), 60000);
    return () => {
      window.removeEventListener("dhapti-notifications-changed", onChange);
      window.clearInterval(timer);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
    void refreshCount();
  }, [open, loadPreview, refreshCount]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const allHref = viewAllPath(location.pathname);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative rounded-xl p-2.5 text-[#002147] transition-colors hover:bg-[#F4F7FB] dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
            style={{ backgroundColor: accentColor }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-[#E5EBF3] bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 sm:w-[360px]"
          )}
        >
          <div className="flex items-center justify-between border-b border-[#E5EBF3] px-3 py-2.5 dark:border-slate-700">
            <p className="text-sm font-bold text-[#002147] dark:text-slate-100">
              Notifications
            </p>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-[#ea580c] hover:underline"
                  onClick={() => {
                    void (async () => {
                      try {
                        await api("/notifications/read-all", { method: "POST" });
                        setCount(0);
                        setItems([]);
                        window.dispatchEvent(
                          new Event("dhapti-notifications-changed")
                        );
                      } catch {
                        /* ignore */
                      }
                    })();
                  }}
                >
                  Mark as read
                </button>
              )}
              {count > 0 && (
                <span className="text-xs text-muted-foreground">
                  {count} unread
                </span>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}
            {!loading && error && (
              <p className="px-3 py-6 text-center text-xs text-red-600">{error}</p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No unread notifications.
              </p>
            )}
            {!loading &&
              !error &&
              items.map((item) => (
                <div
                  key={item.recipientId}
                  className="flex gap-2 border-b border-[#E5EBF3] px-3 py-2.5 last:border-0 dark:border-slate-700"
                >
                  <Link
                    to={item.link || allHref}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1 hover:opacity-90"
                  >
                    <p className="text-sm font-semibold text-[#002147] dark:text-slate-100">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {item.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatNotificationTime(item.createdAt)}
                    </p>
                  </Link>
                  <button
                    type="button"
                    className="shrink-0 self-start text-[10px] font-bold uppercase text-[#16a34a] hover:underline"
                    onClick={() => {
                      void (async () => {
                        try {
                          await api(`/notifications/${item.id}/read`, {
                            method: "PATCH",
                          });
                          setItems((prev) =>
                            prev.filter((n) => n.id !== item.id)
                          );
                          setCount((c) => Math.max(0, c - 1));
                          window.dispatchEvent(
                            new Event("dhapti-notifications-changed")
                          );
                        } catch {
                          /* ignore */
                        }
                      })();
                    }}
                  >
                    Read
                  </button>
                </div>
              ))}
          </div>

          <div className="border-t border-[#E5EBF3] px-3 py-2 dark:border-slate-700">
            <Link
              to={allHref}
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-[#002147] hover:underline dark:text-slate-100"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
