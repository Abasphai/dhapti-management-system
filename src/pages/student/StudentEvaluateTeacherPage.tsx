import { useCallback, useEffect, useState } from "react";
import { Lock, Star } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type EligibleCourse = {
  enrollmentId: string;
  enrollmentStatus: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string;
  teacherCode: string;
  designation: string | null;
  semester: string;
  academicYear: string;
  alreadyRated: boolean;
  isCurrentSemester: boolean;
  semesterWindow: "current" | "past" | "future" | "unknown";
  canEvaluate: boolean;
  evaluationLabel: "open" | "closed" | "not_reached" | "submitted";
};

type StarKey =
  | "overallRating"
  | "teachingQuality"
  | "punctuality"
  | "engagement";

const STAR_FIELDS: Array<{ key: StarKey; label: string }> = [
  { key: "overallRating", label: "Overall rating" },
  { key: "teachingQuality", label: "Teaching quality" },
  { key: "punctuality", label: "Punctuality" },
  { key: "engagement", label: "Engagement" },
];

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} stars`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition hover:scale-110"
        >
          <Star
            className={cn(
              "h-6 w-6",
              n <= value
                ? "fill-[#ea580c] text-[#ea580c]"
                : "text-slate-300 dark:text-slate-600"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function EvaluationStatusBadge({ row }: { row: EligibleCourse }) {
  if (row.alreadyRated || row.evaluationLabel === "submitted") {
    return (
      <Badge className="bg-[#16a34a] text-white hover:bg-[#16a34a]">
        Evaluation Submitted
      </Badge>
    );
  }
  if (row.evaluationLabel === "not_reached" || row.semesterWindow === "future") {
    return (
      <Badge variant="secondary" className="text-slate-600">
        Semester Not Reached
      </Badge>
    );
  }
  if (row.evaluationLabel === "closed" || row.semesterWindow === "past") {
    return (
      <Badge variant="secondary" className="text-amber-800">
        Evaluation Period Closed
      </Badge>
    );
  }
  return <Badge variant="info">Open for evaluation</Badge>;
}

export function StudentEvaluateTeacherPage() {
  const [rows, setRows] = useState<EligibleCourse[]>([]);
  const [currentSemester, setCurrentSemester] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<EligibleCourse | null>(null);
  const [scores, setScores] = useState<Record<StarKey, number>>({
    overallRating: 5,
    teachingQuality: 5,
    punctuality: 5,
    engagement: 5,
  });
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        data: EligibleCourse[];
        currentSemester?: string;
      }>("/ratings/eligible");
      setRows(res.data);
      setCurrentSemester(res.currentSemester ?? "");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load courses"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = (row: EligibleCourse) => {
    if (!row.canEvaluate) return;
    setActive(row);
    setScores({
      overallRating: 5,
      teachingQuality: 5,
      punctuality: 5,
      engagement: 5,
    });
    setComments("");
  };

  const submit = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await api("/ratings", {
        method: "POST",
        body: JSON.stringify({
          teacherId: active.teacherId,
          courseId: active.courseId,
          semester: active.semester,
          academicYear: active.academicYear,
          ...scores,
          comments: comments.trim() || null,
        }),
      });
      toast.success("Lecturer evaluation submitted. Thank you!");
      setActive(null);
      void load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit evaluation"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Evaluate Lecturer"
        description={
          currentSemester
            ? `Evaluations are limited to your current active semester (${currentSemester}). Past and future terms are locked.`
            : "Evaluations are limited to your current active semester only."
        }
      />

      {error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading courses…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No enrolled courses available for evaluation.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.enrollmentId} className="border-[#E5EBF3] shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                      {row.courseCode}
                    </p>
                    <CardTitle className="mt-1 text-lg text-[#002147]">
                      {row.courseTitle}
                    </CardTitle>
                  </div>
                  <EvaluationStatusBadge row={row} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[#002147]">
                  <span className="font-semibold">{row.teacherName}</span>
                  {row.designation ? ` · ${row.designation}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.academicYear} · {row.semester}
                </p>
                {row.canEvaluate ? (
                  <Button
                    className="rounded-xl bg-[#002147] hover:bg-[#003366]"
                    onClick={() => openModal(row)}
                  >
                    <Star className="mr-1.5 h-4 w-4" />
                    Evaluate Lecturer
                  </Button>
                ) : row.alreadyRated ? (
                  <Badge className="bg-[#16a34a] text-white hover:bg-[#16a34a]">
                    Evaluation Submitted
                  </Badge>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    <Lock className="h-3.5 w-3.5" />
                    {row.semesterWindow === "future"
                      ? "Semester Not Reached"
                      : "Evaluation Period Closed"}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Evaluate Lecturer</DialogTitle>
            <DialogDescription>
              {active
                ? `${active.teacherName} — ${active.courseCode} (${active.academicYear} · ${active.semester})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {STAR_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-[#002147]">
                  {field.label}
                </span>
                <StarPicker
                  value={scores[field.key]}
                  onChange={(n) =>
                    setScores((prev) => ({ ...prev, [field.key]: n }))
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#002147]">
                Comments (optional)
              </label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Share constructive feedback…"
                rows={4}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#ea580c] hover:bg-[#c2410c]"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? "Submitting…" : "Submit Evaluation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
