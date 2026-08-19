import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ClipboardCheck } from "lucide-react";

import { PageHeader } from "@/components/portals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

interface TeacherClass {
  id: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  schedule: string | null;
  room: string | null;
  academicYear: string;
  semester: string;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  department: string | null;
}

export function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<{ data: TeacherClass[] }>("/teachers/me/classes")
      .then((res) => {
        if (!cancelled) setClasses(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load your classes"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <PageHeader
            title="My Classes"
            description="Scheduled class sections assigned to you for the current offerings."
          />
        </div>
        <Button asChild variant="outline" className="shrink-0 border-[#E5EBF3]">
          <Link to="/teacher/attendance">
            <ClipboardCheck className="h-4 w-4" />
            Mark Attendance
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="border-[#E5EBF3]">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading your classes…
          </CardContent>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="border-[#E5EBF3]">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              No classes have been scheduled for you yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((item) => (
            <Card
              key={item.id}
              className="border-[#E5EBF3] transition-all hover:shadow-md"
            >
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#E85D04]">
                  {item.courseCode}
                  {item.section ? `-${item.section}` : ""}
                </p>
                <h3 className="mt-1 font-semibold text-[#002147]">
                  {item.courseTitle}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Section {item.section}
                  {item.department ? ` · ${item.department}` : ""}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.schedule || "Schedule not set"}
                </p>
                {item.room && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Room: {item.room}
                  </p>
                )}
                <p className="mt-3 text-xs font-medium text-[#16a34a]">
                  {item.academicYear} · {item.semester}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
