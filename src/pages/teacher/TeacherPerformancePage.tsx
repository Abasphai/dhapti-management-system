import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

type PerformancePayload = {
  teacherId: string;
  teacherName: string;
  totalReviews: number;
  averageOverall: number | null;
  averageTeachingQuality: number | null;
  averagePunctuality: number | null;
  averageEngagement: number | null;
  feedback: Array<{
    id: string;
    courseCode: string;
    courseTitle: string;
    semester: string;
    academicYear: string;
    overallRating: number;
    comments: string | null;
    createdAt: string;
  }>;
};

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB]/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-[#002147] dark:text-slate-100">
        {value != null ? `${value.toFixed(2)} / 5.0` : "—"}
      </p>
    </div>
  );
}

export function TeacherPerformancePage() {
  const [data, setData] = useState<PerformancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<PerformancePayload>("/teachers/me/performance");
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load performance"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="My Performance"
        description="Anonymous student evaluations of your teaching."
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
        <p className="text-sm text-muted-foreground">Loading performance…</p>
      ) : data ? (
        <>
          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3 text-[#002147]">
                <span className="text-3xl font-black">
                  {data.averageOverall != null
                    ? `${data.averageOverall.toFixed(2)} / 5.0`
                    : "No ratings yet"}
                </span>
                {data.averageOverall != null && (
                  <Star className="h-7 w-7 fill-[#ea580c] text-[#ea580c]" />
                )}
                <Badge variant="secondary">
                  {data.totalReviews} review
                  {data.totalReviews === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Teaching quality"
                value={data.averageTeachingQuality}
              />
              <Metric label="Punctuality" value={data.averagePunctuality} />
              <Metric label="Engagement" value={data.averageEngagement} />
            </CardContent>
          </Card>

          <Card className="border-[#E5EBF3] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147]">
                Anonymous student feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No written comments yet.
                </p>
              ) : (
                data.feedback.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E5EBF3] px-4 py-3 dark:border-slate-700"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-[#002147]">
                        {item.courseCode}
                      </span>
                      <span>
                        {item.academicYear} · {item.semester}
                      </span>
                      <Badge variant="secondary">
                        {item.overallRating}/5 ★
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[#002147] dark:text-slate-100">
                      {item.comments}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
