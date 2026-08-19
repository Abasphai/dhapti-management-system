import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type AskQuestionCourse = {
  courseId: string;
  code: string;
  title: string;
  lecturer: string;
};

type Question = {
  id: string;
  subject: string;
  body: string;
  answered: boolean;
  createdAt: string;
  replies: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
  }>;
};

type AskQuestionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: AskQuestionCourse | null;
};

export function AskQuestionModal({
  open,
  onOpenChange,
  course,
}: AskQuestionModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!course?.courseId) {
      setQuestions([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await api<{ data: Question[] }>(
        `/questions/me?courseId=${encodeURIComponent(course.courseId)}`
      );
      setQuestions(res.data ?? []);
    } catch {
      setQuestions([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [course?.courseId]);

  useEffect(() => {
    if (!open) return;
    setSubject("");
    setBody("");
    setExpandedId(null);
    setHistoryOpen(true);
    void loadHistory();
  }, [open, loadHistory]);

  const lecturer = course?.lecturer?.trim() || "your lecturer";
  const headerLabel = course
    ? `${course.code}: ${course.title} — ${lecturer}`
    : "Ask Lecturer";

  const onSubmit = async () => {
    if (!course?.courseId) return;
    if (subject.trim().length < 3) {
      toast.error("Enter a short topic for your question");
      return;
    }
    if (body.trim().length < 5) {
      toast.error("Please write a fuller question message");
      return;
    }
    setSending(true);
    try {
      await api("/questions", {
        method: "POST",
        body: JSON.stringify({
          courseId: course.courseId,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      toast.success(
        `Question sent to ${lecturer}! You will receive an in-app notification when they reply.`
      );
      setSubject("");
      setBody("");
      await loadHistory();
      window.dispatchEvent(new Event("dhapti-notifications-changed"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to send question"
      );
    } finally {
      setSending(false);
    }
  };

  const answered = questions.filter((q) => q.answered);
  const pending = questions.filter((q) => !q.answered);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-base sm:text-lg">
            <MessageSquare className="h-5 w-5 shrink-0 text-[#ea580c]" />
            Ask Lecturer
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold text-[#002147]">
            {headerLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Question Topic / Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Midterm preparation"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Question Message
            </label>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Type your academic question for ${lecturer} here...`}
              maxLength={5000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={sending || !course?.courseId}
            className="bg-[#002147] text-white hover:bg-orange-600"
            onClick={() => void onSubmit()}
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Send Question
          </Button>
        </DialogFooter>

        <div className="border-t border-[#E5EBF3] pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
              Previously Answered Questions
              {answered.length > 0 ? ` (${answered.length})` : ""}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform",
                historyOpen && "rotate-180"
              )}
            />
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-2">
              {loadingHistory ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading history…
                </p>
              ) : answered.length === 0 && pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions for this course yet.
                </p>
              ) : (
                <>
                  {answered.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/60"
                    >
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 p-3 text-left"
                        onClick={() =>
                          setExpandedId((id) => (id === q.id ? null : q.id))
                        }
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#002147]">
                            {q.subject}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                            {q.body}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md bg-[#16a34a]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#16a34a]">
                          Answered
                        </span>
                      </button>
                      {expandedId === q.id && (
                        <div className="space-y-2 border-t border-[#E5EBF3] px-3 pb-3 pt-2">
                          <p className="text-sm text-slate-700">{q.body}</p>
                          {q.replies.map((r) => (
                            <div
                              key={r.id}
                              className="rounded-lg bg-white p-2.5 text-sm shadow-sm"
                            >
                              <p className="text-xs font-bold text-[#16a34a]">
                                {r.authorName}
                              </p>
                              <p className="mt-0.5 text-slate-700">{r.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {pending.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Awaiting reply ({pending.length})
                      </p>
                      {pending.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-xl border border-dashed border-[#E5EBF3] p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-[#002147]">
                              {q.subject}
                            </p>
                            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                              Pending
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{q.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
