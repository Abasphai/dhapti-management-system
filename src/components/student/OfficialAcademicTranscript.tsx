import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TranscriptCourse = {
  id: string;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  letterGradeDisplay: string;
  gradePointDisplay: string;
};

export type TranscriptTerm = {
  academicYear: string;
  semester: string;
  credits: number;
  semesterGpa: number | null;
  courses: TranscriptCourse[];
};

export type TranscriptStudentIdentity = {
  fullName: string;
  registrationNo: string;
  rollNo: string;
  session: string;
};

type Props = {
  student: TranscriptStudentIdentity;
  terms: TranscriptTerm[];
  overall: {
    totalCredits: number;
    cumulativeGpa: number | null;
  };
  creditRequired?: number;
  creditExempted?: number;
  className?: string;
};

/** Reverse-map GPA onto nearest Dhapti letter for summary rows */
export function letterFromGpa(gpa: number | null | undefined): string {
  if (gpa == null || !Number.isFinite(gpa)) return "Incomplete";
  if (gpa >= 3.875) return "A+";
  if (gpa >= 3.625) return "A";
  if (gpa >= 3.375) return "A-";
  if (gpa >= 3.125) return "B+";
  if (gpa >= 2.875) return "B";
  if (gpa >= 2.625) return "B-";
  if (gpa >= 2.375) return "C+";
  if (gpa >= 2.125) return "C";
  if (gpa >= 2.0) return "C-";
  return "F";
}

function formatGpa(gpa: number | null | undefined): string {
  if (gpa == null || !Number.isFinite(gpa)) return "Incomplete";
  return gpa.toFixed(2);
}

function semesterLabel(semester: string): string {
  const match = String(semester).match(/(\d+)/);
  return match ? match[1] : semester;
}

function formatGradePoint(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

const STRIPE_TEXT = Array.from({ length: 12 }, () => "ACADEMIC TRANSCRIPT").join(
  "   ·   "
);

const COLS = [
  { key: "code", label: "Course No", align: "left" as const, width: "18%" },
  { key: "title", label: "Course Title", align: "left" as const, width: "38%" },
  {
    key: "credits",
    label: "Credit Hours",
    align: "center" as const,
    width: "14%",
  },
  {
    key: "grade",
    label: "Grade Earned",
    align: "center" as const,
    width: "15%",
  },
  {
    key: "gp",
    label: "Grade Point",
    align: "center" as const,
    width: "15%",
  },
];

export function OfficialAcademicTranscript({
  student,
  terms,
  overall,
  creditRequired = 148,
  creditExempted = 0,
  className,
}: Props) {
  const avgGrade = letterFromGpa(overall.cumulativeGpa);
  const cgpaLabel =
    overall.cumulativeGpa != null
      ? overall.cumulativeGpa.toFixed(2)
      : "Incomplete";

  return (
    <div className={cn("space-y-4", className)}>
      <div
        id="official-academic-transcript"
        className="official-transcript-root overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white text-[#002147] shadow-sm"
      >
        {/* Official header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5EBF3] px-5 py-4 md:px-7 md:py-5">
          <div className="flex items-center gap-3">
            <img
              src="/dhapti-logo.png"
              alt="DHAPTI"
              className="h-12 w-auto object-contain md:h-14"
            />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#16a34a]">
                Official Record
              </p>
              <h2 className="text-base font-black leading-tight text-[#002147] md:text-xl">
                Dhapti University
              </h2>
              <p className="text-xs font-semibold text-slate-600">
                Office of the Registrar
              </p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-black uppercase tracking-tight text-[#002147] md:text-3xl">
              Academic
              <br className="hidden sm:block" /> Transcript
            </h1>
          </div>
        </div>

        {/* Green running stripe */}
        <div className="overflow-hidden bg-[#16a34a] py-1.5">
          <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.28em] text-white">
            {STRIPE_TEXT}
          </p>
        </div>

        {/* Student identity */}
        <div className="grid gap-2 border-b border-[#E5EBF3] bg-[#F4F7FB] px-5 py-4 md:grid-cols-4 md:px-7">
          <IdentityField label="Name" value={student.fullName.toUpperCase()} />
          <IdentityField label="Reg" value={student.registrationNo} />
          <IdentityField label="Roll" value={student.rollNo} />
          <IdentityField label="Session" value={student.session} />
        </div>

        {/* Semester tables */}
        <div className="space-y-5 px-4 py-5 md:px-7">
          {terms.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-slate-500">
              No approved course results are available on this transcript yet.
            </p>
          )}

          {terms.map((term) => {
            const subjectCount = term.courses.length;
            const avgLetter = letterFromGpa(term.semesterGpa);
            const gpaLabel = formatGpa(term.semesterGpa);
            return (
              <section
                key={`${term.academicYear}-${term.semester}`}
                className="overflow-hidden rounded-xl border border-slate-700/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#002147] px-4 py-2.5 text-white">
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Semester: {semesterLabel(term.semester)}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-200">
                    Session {term.academicYear}
                  </p>
                </div>

                <div className="overflow-x-auto bg-white">
                  <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
                    <colgroup>
                      {COLS.map((col) => (
                        <col key={col.key} style={{ width: col.width }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-[#002147]/80">
                        {COLS.map((col) => (
                          <th
                            key={col.key}
                            scope="col"
                            className={cn(
                              "bg-[#002147]/80 py-3 px-4 text-xs font-black uppercase tracking-wider text-slate-200",
                              col.align === "center" ? "text-center" : "text-left"
                            )}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {term.courses.map((course) => (
                        <tr
                          key={course.id}
                          className="border-b border-[#E5EBF3] last:border-b-0"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-[#002147]">
                            {course.courseCode}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {course.courseTitle}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-[#002147]">
                            {course.creditHours}
                          </td>
                          <td className="px-4 py-3 text-center font-black text-[#002147]">
                            {course.letterGradeDisplay}
                          </td>
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-[#002147]">
                            {formatGradePoint(course.gradePointDisplay)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="transcript-subtotal">
                        <td colSpan={5} className="bg-slate-900 px-4 py-3">
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-slate-100">
                            <span>
                              Subject:{" "}
                              <span className="highlight-green">{subjectCount}</span>
                            </span>
                            <span>
                              Total Credit:{" "}
                              <span className="highlight-green">{term.credits}</span>
                            </span>
                            <span>
                              Avg. Grade:{" "}
                              <span className="highlight-gold">{avgLetter}</span>
                            </span>
                            <span>
                              GPA:{" "}
                              <span className="highlight-gold">{gpaLabel}</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            );
          })}
        </div>

        {/* Total result summary */}
        <div className="border-t-2 border-[#16a34a] px-4 py-5 md:px-7">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#16a34a]">
            Total Result Summary
          </p>
          <div className="grid gap-3 rounded-xl border border-[#16a34a]/30 bg-[#0f172a] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat
              label="Total Credit Required"
              value={String(creditRequired)}
            />
            <SummaryStat
              label="Credit Earned"
              value={String(overall.totalCredits)}
              accent="green"
            />
            <SummaryStat
              label="Average Grade"
              value={avgGrade}
              accent="gold"
            />
            <SummaryStat label="CGPA" value={cgpaLabel} accent="gold" />
          </div>
          {creditExempted > 0 && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Credit Exempted: {creditExempted}
            </p>
          )}
        </div>

        <div className="border-t border-[#E5EBF3] px-5 py-3 text-[10px] font-medium text-slate-500 md:px-7">
          This is a system-generated academic transcript from Dhapti University.
          Verify authenticity with the Office of the Registrar.
        </div>
      </div>

      <div className="no-print flex justify-center pb-2">
        <Button
          type="button"
          className="bg-[#16a34a] px-6 text-base font-bold text-white hover:bg-[#15803d]"
          onClick={() => window.print()}
        >
          <Download className="h-4 w-4" />
          Download Transcript
        </Button>
      </div>
    </div>
  );
}

function IdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-black text-[#002147]">{value || "—"}</p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "gold";
}) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2 ring-1 ring-white/10">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-black",
          accent === "green" && "text-emerald-400",
          accent === "gold" && "text-amber-300",
          !accent && "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}
