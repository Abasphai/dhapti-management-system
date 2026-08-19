import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";

type EnrolledCourse = {
  id: string;
  code: string;
  title: string;
};

type Question = {
  id: string;
  subject: string;
  body: string;
  answered: boolean;
  createdAt: string;
  course: { code: string; title: string };
  replies: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
};

/**
 * Course Q&A panel for enrolled students (Phase 7).
 * Preserves existing My Courses catalog layout — additive section only.
 */
export function StudentCourseQaPanel() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [courseId, setCourseId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadCourses = useCallback(async () => {
    try {
      const res = await api<{
        data: Array<{
          classSection: { course: { id: string; code: string; title: string } };
        }>;
      }>("/students/me/enrollments");
      const map = new Map<string, EnrolledCourse>();
      for (const row of res.data ?? []) {
        const c = row.classSection?.course;
        if (c?.id) map.set(c.id, { id: c.id, code: c.code, title: c.title });
      }
      const list = [...map.values()];
      setCourses(list);
      if (list[0] && !courseId) setCourseId(list[0].id);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const loadQuestions = useCallback(async () => {
    if (!courseId) {
      setQuestions([]);
      return;
    }
    try {
      const res = await api<{ data: Question[] }>(
        `/questions/me?courseId=${encodeURIComponent(courseId)}`
      );
      setQuestions(res.data ?? []);
    } catch {
      setQuestions([]);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const onSubmit = async () => {
    if (!courseId || !subject.trim() || !body.trim()) {
      toast.error("Select a course and enter subject and question");
      return;
    }
    setSending(true);
    try {
      await api("/questions", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      toast.success("Question submitted to your instructor");
      setSubject("");
      setBody("");
      await loadQuestions();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit question"
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;
  if (courses.length === 0) return null;

  return (
    <Card className="border-[#E5EBF3] shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[#002147]">
          <MessageSquare className="h-4 w-4 text-[#ea580c]" />
          Ask your instructor
        </CardTitle>
        <CardDescription>
          Submit questions for courses you are enrolled in. Replies appear here
          and trigger a notification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <Input
            className="md:col-span-2"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <Textarea
          rows={3}
          placeholder="Write your question…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="button" disabled={sending} onClick={() => void onSubmit()}>
          <Send className="mr-1.5 h-4 w-4" />
          Submit question
        </Button>

        <div className="space-y-3 border-t border-[#E5EBF3] pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
            Your questions
          </p>
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-[#E5EBF3] p-3 text-sm dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[#002147]">{q.subject}</p>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {q.answered ? "Answered" : "Pending"}
                </span>
              </div>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{q.body}</p>
              {q.replies.map((r) => (
                <div
                  key={r.id}
                  className="mt-2 rounded-lg bg-[#F4F7FB] p-2 dark:bg-slate-800"
                >
                  <p className="text-xs font-bold text-[#16a34a]">
                    {r.authorName}
                  </p>
                  <p className="mt-0.5">{r.body}</p>
                </div>
              ))}
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No questions for this course yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
