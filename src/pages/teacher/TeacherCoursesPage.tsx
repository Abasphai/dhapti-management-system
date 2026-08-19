import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/portals";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

interface TeacherCourse {
  courseId: string;
  code: string;
  title: string;
  credits?: number;
  semester?: string | null;
  department?: string | null;
  faculty?: string | null;
  status?: string;
}

export function TeacherCoursesPage() {
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<{ data: TeacherCourse[] }>("/teachers/me/courses")
      .then((res) => {
        if (!cancelled) setCourses(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load your assigned courses"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="My Courses"
        description="Courses assigned to you by the university administration."
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="border-[#E5EBF3]">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading your courses…
          </CardContent>
        </Card>
      ) : courses.length === 0 ? (
        <Card className="border-[#E5EBF3]">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              No courses have been assigned to you yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <Card
              key={course.courseId}
              className="border-[#E5EBF3] transition-all hover:shadow-md"
            >
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#E85D04]">
                  {course.code}
                </p>
                <h3 className="mt-1 font-semibold text-[#002147]">
                  {course.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[course.department, course.faculty].filter(Boolean).join(" · ") ||
                    "Academic course"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-[#16a34a]">
                  {typeof course.credits === "number" && (
                    <span>{course.credits} credits</span>
                  )}
                  {course.semester && <span>{course.semester}</span>}
                  {course.status && <span>{course.status}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
