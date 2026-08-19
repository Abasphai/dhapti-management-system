import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { DHAPTI_IMAGES } from "@/data/publicSite";

type VerifyOk = {
  status: "VALID";
  studentName: string;
  degreeTitle: string;
  facultyName: string;
  programName: string | null;
  graduationDate: string;
  issuedAt: string;
  verificationCode: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export function VerifyCertificatePage() {
  const { code = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyOk | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setInvalid(false);
      setData(null);
      try {
        const res = await fetch(
          `${API_BASE}/public/certificates/verify/${encodeURIComponent(code.trim().toUpperCase())}`
        );
        if (cancelled) return;
        if (!res.ok) {
          setInvalid(true);
          return;
        }
        const json = (await res.json()) as VerifyOk;
        setData(json);
      } catch {
        if (!cancelled) setInvalid(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#002147]">
      <header className="border-b border-[#E5EBF3] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/dhapti-logo.png" alt="DHAPTI" className="h-12 w-auto object-contain md:h-14" />
          <div>
            <p className="text-sm font-bold tracking-wide">Dhapti University</p>
            <p className="text-xs text-slate-500">Certificate Verification</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div
          className="overflow-hidden rounded-3xl border border-[#E5EBF3] bg-white shadow-sm"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.97), rgba(255,255,255,.97)), url(${DHAPTI_IMAGES.campus})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="p-8 md:p-10">
            <h1 className="text-2xl font-black md:text-3xl">
              Degree Certificate Verification
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Code:{" "}
              <span className="font-mono font-semibold tracking-wider text-[#002147]">
                {code.toUpperCase() || "—"}
              </span>
            </p>

            {loading && (
              <p className="mt-8 text-sm text-slate-500">Verifying certificate…</p>
            )}

            {!loading && data && (
              <div className="mt-8 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
                  <ShieldCheck className="h-4 w-4" />
                  Valid Certificate
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                      Student Name
                    </dt>
                    <dd className="mt-1 text-lg font-semibold">{data.studentName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                      Degree Title
                    </dt>
                    <dd className="mt-1 text-lg font-semibold">{data.degreeTitle}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                      Faculty
                    </dt>
                    <dd className="mt-1 font-medium">{data.facultyName}</dd>
                  </div>
                  {data.programName && (
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                        Program
                      </dt>
                      <dd className="mt-1 font-medium">{data.programName}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                      Graduation Date
                    </dt>
                    <dd className="mt-1 font-medium">{data.graduationDate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                      Issue Date
                    </dt>
                    <dd className="mt-1 font-medium">{data.issuedAt}</dd>
                  </div>
                </dl>
                <p className="flex items-start gap-2 text-sm text-slate-500">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                  This record was issued by Dhapti Registrar. No private contact details or
                  grades are shown on this public page.
                </p>
              </div>
            )}

            {!loading && invalid && (
              <div className="mt-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
                  <ShieldAlert className="h-4 w-4" />
                  Invalid / Not Found
                </div>
                <p className="max-w-xl text-slate-600">
                  No valid certificate matches this verification code. Check the
                  code and try again, or contact the Dhapti Registrar.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
