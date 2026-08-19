import { Printer } from "lucide-react";

import { MockQrCode } from "@/components/common/MockQrCode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DigitalIdCardProps = {
  role: "STUDENT" | "TEACHER";
  fullName: string;
  registrationId: string;
  facultyOrDepartment: string;
  academicYear: string;
  photoUrl?: string;
  email?: string;
};

export function DigitalIdCard({
  role,
  fullName,
  registrationId,
  facultyOrDepartment,
  academicYear,
  photoUrl = "/images/profile-user.jpg",
  email,
}: DigitalIdCardProps) {
  const qrValue = `DHAPTI|${role}|${registrationId}|${fullName}`;
  const roleLabel = role === "STUDENT" ? "Student ID Card" : "Faculty ID Card";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#002147] dark:text-slate-100">
            Digital ID Card
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Official Dhapti identification — print or save as PDF from your browser.
          </p>
        </div>
        <Button
          type="button"
          onClick={handlePrint}
          className="gap-2 bg-[#002147] text-white hover:bg-[#003366]"
        >
          <Printer className="h-4 w-4" />
          Print / Download ID Card
        </Button>
      </div>

      <div className="print-id-root mx-auto flex max-w-3xl flex-col gap-6 md:flex-row md:justify-center">
        {/* FRONT — white badge surface (immune to portal dark overrides) */}
        <article
          className={cn(
            "id-card-face id-card-front relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white shadow-xl",
            "print:shadow-none"
          )}
        >
          <div className="bg-[#002147] px-5 py-3">
            <div className="flex items-center gap-3">
              <img
                src="/dhapti-logo.png"
                alt="DHAPTI"
                className="h-12 w-auto object-contain brightness-0 invert md:h-14"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ea580c]">
                  Dhapti University
                </p>
                <p className="text-sm font-bold text-white">{roleLabel}</p>
              </div>
            </div>
          </div>

          <div className="relative bg-white px-5 py-5">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-[#ea580c]/10" />
            <div className="relative z-10 flex gap-4">
              <img
                src={photoUrl}
                alt={fullName}
                className="h-24 w-20 shrink-0 rounded-lg border-2 border-[#002147] object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/images/profile-user.jpg";
                }}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="id-card-name text-xl font-black leading-tight text-[#002147] md:text-2xl">
                  {fullName}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                  {role === "STUDENT" ? "Student" : "Faculty"}
                </p>
                <dl className="space-y-2">
                  <div>
                    <dt className="id-card-label text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      ID
                    </dt>
                    <dd className="id-card-value font-mono text-sm font-extrabold text-[#002147]">
                      {registrationId}
                    </dd>
                  </div>
                  <div>
                    <dt className="id-card-label text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {role === "STUDENT" ? "Faculty" : "Department"}
                    </dt>
                    <dd className="id-card-value text-sm font-extrabold text-[#002147]">
                      {facultyOrDepartment}
                    </dd>
                  </div>
                  <div>
                    <dt className="id-card-label text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Academic Year
                    </dt>
                    <dd className="id-card-value text-sm font-extrabold text-[#002147]">
                      {academicYear}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="relative z-10 mt-4 flex items-end justify-between border-t border-[#E5EBF3] pt-3">
              <p className="id-card-hint max-w-[160px] text-[10px] font-medium leading-relaxed text-slate-600">
                Scan QR to verify identity on campus systems.
                {email ? ` · ${email}` : ""}
              </p>
              <MockQrCode
                value={qrValue}
                size={72}
                className="rounded border border-[#E5EBF3]"
              />
            </div>
          </div>
          <div className="h-1.5 bg-gradient-to-r from-[#002147] via-[#ea580c] to-[#16a34a]" />
        </article>

        {/* BACK — dark navy surface with light text */}
        <article className="id-card-face id-card-back relative w-full max-w-[340px] overflow-hidden rounded-2xl border border-[#001a38] bg-[#002147] shadow-xl print:shadow-none">
          <div className="border-b border-white/15 px-5 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              Card Terms & Information
            </p>
          </div>
          <div className="space-y-4 px-5 py-5 text-[11px] leading-relaxed text-slate-200">
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-white">
                Terms of Use
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-white/90">
                <li>This card remains property of Dhapti.</li>
                <li>Present upon request by university security or staff.</li>
                <li>Report loss immediately to the Registrar&apos;s Office.</li>
                <li>Misuse may result in disciplinary action.</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-white">
                Emergency Contact
              </h3>
              <p className="text-white/90">Campus Security: +252 61 700 1190</p>
              <p className="text-white/90">Health Clinic: +252 61 700 1180</p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-white">
                Dhapti Main Campus
              </h3>
              <p className="text-white/90">
                Dhapti Campus, Bay Region, Somalia
              </p>
              <p className="text-white/90">
                info@dhapti.edu.so · +252 61 700 1000
              </p>
            </div>
            <div className="border-t border-dashed border-white/25 pt-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="mb-1 h-8 w-28 border-b border-white/50" />
                  <p className="text-[10px] font-bold text-white">
                    University Registrar
                  </p>
                  <p className="text-[9px] text-slate-300">Authorized Signature</p>
                </div>
                <img
                  src="/dhapti-logo.png"
                  alt=""
                  className="h-12 w-auto object-contain brightness-0 invert opacity-40 md:h-14"
                />
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-gradient-to-r from-[#16a34a] via-[#ea580c] to-white/40" />
        </article>
      </div>
    </div>
  );
}
