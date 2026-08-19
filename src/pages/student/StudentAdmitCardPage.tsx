import { useEffect, useRef, useState } from "react";
import { Lock, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdmitPayload = {
  status: "CLEARED" | "HELD";
  message?: string;
  examSession: {
    id: string;
    title: string;
    semester: string | null;
    status: string;
    published: boolean;
  } | null;
  clearance: {
    attendancePercent: number | null;
    pendingDues: number;
    criteria: Array<{
      key: string;
      met: boolean;
      label: string;
      detail: string;
    }>;
    blockers: string[];
    manualOverride: boolean;
    overrideReason: string | null;
  } | null;
  student: {
    id: string;
    fullName: string;
    studentCode: string;
    rollNumber: string;
    faculty: string | null;
    semester: string | null;
    program: string | null;
    profilePhoto: string;
  } | null;
  timetable: Array<{
    id: string;
    courseCode: string;
    courseTitle: string;
    examDate: string;
    timeSlot: string;
    room: string;
    seat: string;
  }>;
  admitCard: {
    id: string;
    verificationCode: string;
    generatedAt: string | null;
    qrPayload: string;
  } | null;
};

function formatExamDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function StudentAdmitCardPage() {
  const [data, setData] = useState<AdmitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api<AdmitPayload>("/student/admit-card");
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load admit card"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPrint = () => {
    if (!printRef.current) return;
    window.print();
    toast.success("Admit card sent to print dialog");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm font-semibold text-[#002147]">
          Evaluating exam clearance…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-sm font-semibold text-red-800">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.examSession) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-black text-[#002147]">Exam Admit Card</h1>
        <Card className="border-[#E5EBF3]">
          <CardContent className="p-6 text-sm font-semibold text-[#002147]">
            {data?.message || "No exam session is currently scheduled."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "HELD" || !data.admitCard || !data.student) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-black text-[#002147]">Exam Admit Card</h1>
          <p className="mt-1 text-sm font-semibold text-[#334155]">
            {data.examSession.title}
            {data.examSession.semester ? ` · ${data.examSession.semester}` : ""}
          </p>
        </div>
        <Card className="border-2 border-red-500/40 bg-red-50 shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white">
                <Lock className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-black text-red-900">
                  Exam Clearance Blocked
                </h2>
                <p className="mt-1 text-sm font-semibold text-red-800">
                  You are not cleared to sit examinations until the criteria
                  below are met (or Controllers of Examinations grant an
                  override).
                </p>
              </div>
            </div>
            <ul className="space-y-2 rounded-xl border border-red-200 bg-white p-4">
              {(data.clearance?.blockers?.length
                ? data.clearance.blockers
                : ["Clearance requirements not met"]
              ).map((b) => (
                <li
                  key={b}
                  className="text-sm font-bold text-[#7f1d1d]"
                >
                  • {b}
                </li>
              ))}
            </ul>
            {data.clearance?.criteria && (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.clearance.criteria.map((c) => (
                  <div
                    key={c.key}
                    className={cn(
                      "rounded-xl border p-4",
                      c.met
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-white"
                    )}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-[#002147]">
                      {c.label}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        c.met ? "text-emerald-900" : "text-red-900"
                      )}
                    >
                      {c.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { student, admitCard, timetable, examSession } = data;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    admitCard.qrPayload
  )}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-[#002147]">Exam Admit Card</h1>
          <p className="mt-1 text-sm font-semibold text-[#334155]">
            Status:{" "}
            <span className="font-black text-[#16a34a]">CLEARED</span>
            {data.clearance?.manualOverride ? " (manual override)" : ""}
          </p>
        </div>
        <Button
          type="button"
          onClick={onPrint}
          className="gap-2 bg-[#002147] font-bold text-white hover:bg-[#003366]"
        >
          <Printer className="h-4 w-4" />
          Print Exam Admit Card
        </Button>
      </div>

      <div
        ref={printRef}
        id="exam-admit-card-print"
        className="overflow-hidden rounded-2xl border-2 border-[#002147] bg-white shadow-lg print:rounded-none print:border print:shadow-none"
      >
        <div className="flex items-center gap-4 bg-[#002147] px-6 py-5 text-white">
          <img
            src="/dhapti-logo.png"
            alt="DHAPTI"
            className="h-14 w-14 rounded-lg bg-white object-contain p-1"
          />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              Dhapti University
            </p>
            <h2 className="text-xl font-black md:text-2xl">
              Examination Admit Card / Hall Ticket
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {examSession.title}
              {examSession.semester ? ` · ${examSession.semester}` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[140px_1fr_140px]">
          <img
            src={student.profilePhoto || "/images/profile-user.jpg"}
            alt={student.fullName}
            className="mx-auto h-36 w-28 rounded-lg border-2 border-[#E5EBF3] object-cover"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Student Name" value={student.fullName} />
            <Field label="Registration ID" value={student.studentCode} />
            <Field label="Roll Number" value={student.rollNumber} />
            <Field label="Faculty" value={student.faculty || "—"} />
            <Field label="Semester" value={student.semester || "—"} />
            <Field label="Program" value={student.program || "—"} />
          </div>
          <div className="mx-auto text-center">
            <img
              src={qrUrl}
              alt={`QR ${admitCard.verificationCode}`}
              className="mx-auto h-[140px] w-[140px] rounded-lg border border-[#E5EBF3] bg-white p-1"
            />
            <p className="mt-2 font-mono text-[10px] font-bold tracking-wider text-[#002147]">
              {admitCard.verificationCode}
            </p>
          </div>
        </div>

        <div className="px-6 pb-2">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-[#002147]">
            Examination Timetable
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[#E5EBF3]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#F4F7FB] text-[#002147]">
                <tr>
                  <th className="px-3 py-2 font-bold">Course Code</th>
                  <th className="px-3 py-2 font-bold">Course Title</th>
                  <th className="px-3 py-2 font-bold">Exam Date</th>
                  <th className="px-3 py-2 font-bold">Time Slot</th>
                  <th className="px-3 py-2 font-bold">Room / Seat</th>
                </tr>
              </thead>
              <tbody>
                {timetable.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center font-semibold text-[#334155]"
                    >
                      No papers scheduled for your enrolled courses yet.
                    </td>
                  </tr>
                ) : (
                  timetable.map((row) => (
                    <tr key={row.id} className="border-t border-[#E5EBF3]">
                      <td className="px-3 py-2 font-bold text-[#002147]">
                        {row.courseCode}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#002147]">
                        {row.courseTitle}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#002147]">
                        {formatExamDate(row.examDate)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#002147]">
                        {row.timeSlot}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#002147]">
                        {row.room} / {row.seat}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#002147]">
              Instructions for Candidates
            </h3>
            <ul className="mt-2 space-y-1 text-xs font-semibold leading-relaxed text-[#1e293b]">
              <li>• Bring this admit card and a valid photo ID to every paper.</li>
              <li>• Arrive at least 30 minutes before the scheduled start.</li>
              <li>• Mobile phones and unauthorized materials are prohibited.</li>
              <li>• Follow invigilator instructions; malpractice leads to cancellation.</li>
            </ul>
          </div>
          <div className="flex flex-col items-end justify-end text-right">
            <div className="h-12 w-48 border-b-2 border-dashed border-[#002147]" />
            <p className="mt-2 text-xs font-bold text-[#002147]">
              Controller of Examinations
            </p>
            <p className="text-[10px] font-semibold text-[#334155]">
              Signature / Stamp
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #exam-admit-card-print, #exam-admit-card-print * {
            visibility: visible !important;
          }
          #exam-admit-card-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
        {label}
      </p>
      <p className="text-sm font-bold text-[#002147]">{value}</p>
    </div>
  );
}
