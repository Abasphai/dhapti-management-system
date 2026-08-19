import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Play,
  RefreshCw,
} from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

type QuestionType =
  | "MULTIPLE_CHOICE_SINGLE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER";

interface StudentChoice {
  id: string;
  label: string;
  orderIndex: number;
}

interface StudentQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  marks: number;
  orderIndex: number;
  choices: StudentChoice[];
}

interface LatestAttempt {
  id: string;
  attemptNumber: number;
  status: string;
  gradeStatus: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
}

interface QuizListItem {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMinutes: number;
  availableFrom: string | null;
  availableUntil: string | null;
  maxAttempts: number;
  totalMarks: number;
  questionCount: number;
  attemptCount: number;
  courseCode: string;
  courseTitle: string;
  section: string;
  course?: { code: string; title: string };
  classSection?: { section: string };
  teacher?: { name: string; fullName?: string };
  teacherName?: string;
  latestAttempt: LatestAttempt | null;
}

interface AttemptState {
  id: string;
  quizId: string;
  status: string;
  remainingSeconds: number | null;
  gradeStatus: string;
  score: number | null;
  answers?: {
    questionId: string;
    choiceId: string | null;
    answerText: string | null;
  }[];
}

interface QuizDetail {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  totalMarks: number;
  questions: StudentQuestion[];
}

interface ListResponse {
  data: QuizListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type AnswerMap = Record<
  string,
  { choiceId?: string | null; answerText?: string | null }
>;

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Open";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTimer(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

function isAnswered(answer: AnswerMap[string] | undefined) {
  if (!answer) return false;
  if (answer.choiceId) return true;
  if (answer.answerText && answer.answerText.trim()) return true;
  return false;
}

export function StudentQuizzesPage() {
  const [rows, setRows] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "taking" | "submitted">("list");
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [takeError, setTakeError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const autoSubmitRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ListResponse>(
        "/students/me/quizzes?page=1&pageSize=50"
      );
      setRows(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load quizzes"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enterAttempt = async (quizId: string, attemptId: string) => {
    setTakeError(null);
    setSaveNotice(null);
    autoSubmitRef.current = false;
    try {
      const [quizDetail, attemptDetail] = await Promise.all([
        api<QuizDetail>(`/quizzes/${quizId}`),
        api<AttemptState>(`/attempts/${attemptId}`),
      ]);
      const map: AnswerMap = {};
      for (const a of attemptDetail.answers ?? []) {
        map[a.questionId] = {
          choiceId: a.choiceId,
          answerText: a.answerText,
        };
      }
      setQuiz(quizDetail);
      setAttempt(attemptDetail);
      setAnswers(map);
      setCurrentIndex(0);
      setRemainingSeconds(attemptDetail.remainingSeconds);
      if (
        attemptDetail.status === "SUBMITTED" ||
        attemptDetail.status === "EXPIRED"
      ) {
        setMode("submitted");
      } else {
        setMode("taking");
      }
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to open quiz attempt"
      );
    }
  };

  const startOrResume = async (row: QuizListItem) => {
    setActionError(null);
    setStartingId(row.id);
    try {
      if (row.latestAttempt?.status === "IN_PROGRESS") {
        await enterAttempt(row.id, row.latestAttempt.id);
        return;
      }
      const started = await api<AttemptState>(`/quizzes/${row.id}/attempts`, {
        method: "POST",
      });
      await enterAttempt(row.id, started.id);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to start quiz"
      );
    } finally {
      setStartingId(null);
    }
  };

  const saveAnswers = useCallback(
    async (nextAnswers?: AnswerMap) => {
      if (!attempt || attempt.status !== "IN_PROGRESS") return;
      const source = nextAnswers ?? answersRef.current;
      const payload = Object.entries(source)
        .filter(([, v]) => isAnswered(v))
        .map(([questionId, v]) => ({
          questionId,
          choiceId: v.choiceId ?? null,
          answerText: v.answerText ?? null,
        }));
      if (payload.length === 0) return;

      setSaving(true);
      setTakeError(null);
      try {
        const updated = await api<AttemptState>(
          `/attempts/${attempt.id}/answers`,
          {
            method: "PATCH",
            body: JSON.stringify({ answers: payload }),
          }
        );
        setAttempt(updated);
        if (updated.remainingSeconds != null) {
          setRemainingSeconds(updated.remainingSeconds);
        }
        setSaveNotice("Answers saved");
        window.setTimeout(() => setSaveNotice(null), 1500);
      } catch (err) {
        setTakeError(
          err instanceof ApiError ? err.message : "Failed to save answers"
        );
      } finally {
        setSaving(false);
      }
    },
    [attempt]
  );

  const submitAttempt = useCallback(
    async (fromTimer = false) => {
      if (!attempt || submitting || autoSubmitRef.current) return;
      autoSubmitRef.current = true;
      setSubmitting(true);
      setTakeError(null);
      setConfirmSubmit(false);
      try {
        await saveAnswers();
        const payload = Object.entries(answersRef.current)
          .filter(([, v]) => isAnswered(v))
          .map(([questionId, v]) => ({
            questionId,
            choiceId: v.choiceId ?? null,
            answerText: v.answerText ?? null,
          }));
        const result = await api<AttemptState>(
          `/attempts/${attempt.id}/submit`,
          {
            method: "POST",
            body: JSON.stringify(
              payload.length ? { answers: payload } : {}
            ),
          }
        );
        setAttempt(result);
        setMode("submitted");
        await load();
      } catch (err) {
        setTakeError(
          err instanceof ApiError ? err.message : "Failed to submit quiz"
        );
        if (!fromTimer) autoSubmitRef.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [attempt, load, saveAnswers, submitting]
  );

  useEffect(() => {
    if (mode !== "taking" || remainingSeconds == null) return;
    if (remainingSeconds <= 0) {
      void submitAttempt(true);
      return;
    }
    const t = window.setTimeout(() => {
      setRemainingSeconds((s) => (s == null ? s : s - 1));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [mode, remainingSeconds, submitAttempt]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions]);
  const current = questions[currentIndex] ?? null;

  const unansweredCount = useMemo(() => {
    return questions.filter((q) => !isAnswered(answers[q.id])).length;
  }, [answers, questions]);

  const setChoice = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { choiceId, answerText: null },
    }));
  };

  const setText = (questionId: string, answerText: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { choiceId: null, answerText },
    }));
  };

  const exitToList = () => {
    setMode("list");
    setQuiz(null);
    setAttempt(null);
    setAnswers({});
    setRemainingSeconds(null);
    setTakeError(null);
    setConfirmSubmit(false);
    void load();
  };

  if (mode === "submitted") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="space-y-4 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#16a34a]" />
            <h1 className="text-2xl font-bold text-[#002147]">
              Submitted — awaiting admin approval
            </h1>
            <p className="text-muted-foreground">
              Your quiz attempt was submitted successfully. Your score will
              appear in results after an administrator approves it.
            </p>
            {quiz && (
              <p className="text-sm font-medium text-[#002147]">{quiz.title}</p>
            )}
            <Button
              className="bg-[#002147] text-white hover:bg-[#003366]"
              onClick={exitToList}
            >
              Back to quizzes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "taking" && quiz && attempt && current) {
    const timerUrgent =
      remainingSeconds != null && remainingSeconds <= 60;
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-[#E5EBF3] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#002147]">{quiz.title}</h1>
            <p className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length} ·{" "}
              {unansweredCount} unanswered
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveNotice && (
              <span className="text-xs font-semibold text-[#16a34a]">
                {saveNotice}
              </span>
            )}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                timerUrgent
                  ? "bg-red-50 text-red-700"
                  : "bg-[#F4F7FB] text-[#002147]"
              }`}
            >
              <Clock className="h-4 w-4" />
              {remainingSeconds != null
                ? formatTimer(remainingSeconds)
                : "--:--"}
            </div>
            <Button
              variant="outline"
              disabled={saving || submitting}
              onClick={() => void saveAnswers()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              className="bg-[#E85D04] text-white hover:bg-[#d45303]"
              disabled={submitting}
              onClick={() => setConfirmSubmit(true)}
            >
              Submit
            </Button>
          </div>
        </div>

        {takeError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {takeError}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {questions.map((q, i) => {
            const answered = isAnswered(answers[q.id]);
            const active = i === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[#002147] bg-[#002147] text-white"
                    : answered
                      ? "border-[#16a34a]/40 bg-[#16a34a]/10 text-[#15803d]"
                      : "border-[#E5EBF3] bg-white text-muted-foreground"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <Card className="border-[#E5EBF3] shadow-sm">
          <CardHeader>
            <CardDescription className="font-semibold uppercase tracking-wide text-[#E85D04]">
              {current.type === "MULTIPLE_CHOICE_SINGLE"
                ? "Multiple choice"
                : current.type === "TRUE_FALSE"
                  ? "True / False"
                  : "Short answer"}{" "}
              · {current.marks} marks
            </CardDescription>
            <CardTitle className="text-lg leading-relaxed text-[#002147]">
              {current.prompt}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(current.type === "MULTIPLE_CHOICE_SINGLE" ||
              current.type === "TRUE_FALSE") &&
              current.choices.map((choice) => {
                const selected = answers[current.id]?.choiceId === choice.id;
                return (
                  <label
                    key={choice.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                      selected
                        ? "border-[#002147] bg-[#002147]/5"
                        : "border-[#E5EBF3] hover:bg-[#F4F7FB]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${current.id}`}
                      checked={selected}
                      onChange={() => setChoice(current.id, choice.id)}
                      className="accent-[#E85D04]"
                    />
                    <span className="font-medium text-[#002147]">
                      {choice.label}
                    </span>
                  </label>
                );
              })}

            {current.type === "SHORT_ANSWER" && (
              <Input
                value={answers[current.id]?.answerText ?? ""}
                onChange={(e) => setText(current.id, e.target.value)}
                placeholder="Type your answer…"
                className="h-11 rounded-xl"
              />
            )}

            <div className="flex items-center justify-between border-t border-[#E5EBF3] pt-4">
              <Button
                variant="outline"
                disabled={currentIndex <= 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={currentIndex >= questions.length - 1}
                onClick={() =>
                  setCurrentIndex((i) =>
                    Math.min(questions.length - 1, i + 1)
                  )
                }
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit quiz?</DialogTitle>
              <DialogDescription>
                {unansweredCount > 0
                  ? `You still have ${unansweredCount} unanswered question${unansweredCount === 1 ? "" : "s"}. You cannot change answers after submitting.`
                  : "You cannot change answers after submitting."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmSubmit(false)}
              >
                Keep working
              </Button>
              <Button
                className="bg-[#E85D04] text-white hover:bg-[#d45303]"
                disabled={submitting}
                onClick={() => void submitAttempt(false)}
              >
                {submitting ? "Submitting…" : "Confirm submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Quizzes"
        description="Published quizzes from your active class enrollments."
      />

      {(error || actionError) && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error || actionError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            className="shrink-0 border-red-200 bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="h-44 animate-pulse border-[#E5EBF3] bg-[#F4F7FB]/80"
            >
              <CardContent />
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card className="border-[#E5EBF3] shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            No quizzes available right now.
          </CardContent>
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((quizItem, index) => {
            const attemptsUsed = quizItem.attemptCount ?? 0;
            const remaining = Math.max(
              0,
              quizItem.maxAttempts - attemptsUsed
            );
            const inProgress =
              quizItem.latestAttempt?.status === "IN_PROGRESS";
            const canStart = inProgress || remaining > 0;
            const courseCode =
              quizItem.courseCode || quizItem.course?.code || "";
            const courseTitle =
              quizItem.courseTitle || quizItem.course?.title || "";
            const section =
              quizItem.section || quizItem.classSection?.section || "";

            return (
              <motion.div
                key={quizItem.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className="flex h-full flex-col border-[#E5EBF3] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-[#E85D04]/10 text-[#E85D04]"
                      >
                        {courseCode}
                      </Badge>
                      {inProgress ? (
                        <Badge variant="warning">In progress</Badge>
                      ) : (
                        <Badge variant="success">Available</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg text-[#002147]">
                      {quizItem.title}
                    </CardTitle>
                    <CardDescription>
                      {courseTitle} — Section {section}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#E85D04]" />
                      Duration: {quizItem.durationMinutes} minutes
                    </p>
                    <p className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-[#002147]" />
                      {quizItem.questionCount} questions ·{" "}
                      {quizItem.totalMarks} marks
                    </p>
                    <p>
                      Attempts remaining:{" "}
                      <span className="font-semibold text-[#002147]">
                        {inProgress ? `${remaining} (+ resume)` : remaining}
                      </span>
                    </p>
                    <p className="text-xs">
                      Available {formatDate(quizItem.availableFrom)} →{" "}
                      {formatDate(quizItem.availableUntil)}
                    </p>
                    <Button
                      className="w-full rounded-xl bg-[#002147] text-white hover:bg-[#003366]"
                      disabled={!canStart || startingId === quizItem.id}
                      onClick={() => void startOrResume(quizItem)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {startingId === quizItem.id
                        ? "Starting…"
                        : inProgress
                          ? "Resume Quiz"
                          : "Start Attempt"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
