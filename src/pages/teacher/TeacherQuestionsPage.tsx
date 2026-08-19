import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  subject: string;
  body: string;
  authorName: string;
  studentCode: string | null;
  createdAt: string;
  answered: boolean;
  course: { id: string; code: string; title: string };
  replies: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
  }>;
};

export function TeacherQuestionsPage() {
  const [status, setStatus] = useState<"all" | "answered" | "unanswered">(
    "unanswered"
  );
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: Question[] }>(
        `/questions/teacher?status=${status}&pageSize=50`
      );
      setItems(res.data ?? []);
      if (res.data?.length && !selectedId) {
        setSelectedId(res.data[0]!.id);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load questions"
      );
    } finally {
      setLoading(false);
    }
  }, [status, selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on status only
  }, [status]);

  const selected = items.find((q) => q.id === selectedId) ?? null;

  const onReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const updated = await api<Question>(`/questions/${selected.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim() }),
      });
      toast.success("Reply sent — student notified");
      setReply("");
      setItems((prev) =>
        prev.map((q) => (q.id === updated.id ? updated : q))
      );
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to send reply"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Student Questions"
          description="Answer questions from students enrolled in your courses. Replies send an in-app notification."
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["unanswered", "answered", "all"] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => {
              setSelectedId(null);
              setStatus(s);
            }}
          >
            {s === "unanswered"
              ? "Unanswered"
              : s === "answered"
                ? "Answered"
                : "All"}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inbox</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${items.length} question(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
            {items.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedId(q.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  selectedId === q.id
                    ? "border-[#ea580c] bg-[#FFF7ED]"
                    : "border-[#E5EBF3] hover:bg-[#F4F7FB]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-[#002147]">
                    {q.subject}
                  </p>
                  <Badge variant={q.answered ? "secondary" : "default"}>
                    {q.answered ? "Answered" : "Open"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {q.course.code} · {q.authorName}
                </p>
              </button>
            ))}
            {!loading && items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No questions in this filter.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E5EBF3] shadow-sm">
          {!selected ? (
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">Select a question to reply</p>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-lg text-[#002147]">
                  {selected.subject}
                </CardTitle>
                <CardDescription>
                  {selected.course.code} — {selected.course.title} ·{" "}
                  {selected.authorName}
                  {selected.studentCode ? ` (${selected.studentCode})` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-[#F4F7FB] p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {selected.body}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                    Replies
                  </p>
                  {selected.replies.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-[#E5EBF3] p-3 text-sm dark:border-slate-700"
                    >
                      <p className="font-semibold text-[#002147]">
                        {r.authorName}
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        {r.body}
                      </p>
                    </div>
                  ))}
                  {selected.replies.length === 0 && (
                    <p className="text-sm text-muted-foreground">No replies yet.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Textarea
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write your reply…"
                  />
                  <Button
                    type="button"
                    disabled={sending || !reply.trim()}
                    onClick={() => void onReply()}
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    Send reply
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
