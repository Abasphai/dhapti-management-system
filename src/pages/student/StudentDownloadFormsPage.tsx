import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const forms = [
  {
    id: "scholarship",
    title: "Scholarship Form",
    description: "Apply for merit and need-based scholarships.",
    code: "SCH-01",
  },
  {
    id: "readmission",
    title: "Re-admission Form",
    description: "Request re-enrollment after semester break.",
    code: "RAD-02",
  },
  {
    id: "bank-slip",
    title: "Bank Slip",
    description: "Download tuition payment deposit slip.",
    code: "BNK-03",
  },
  {
    id: "provisional",
    title: "Provisional Certificate",
    description: "Request provisional academic certificate.",
    code: "PRV-04",
  },
  {
    id: "testimonial",
    title: "Testimonial",
    description: "Character / academic testimonial request.",
    code: "TST-05",
  },
  {
    id: "iwm",
    title: "IWM Form",
    description: "Industrial Work / Internship materials form.",
    code: "IWM-06",
  },
];

function downloadFormPdf(title: string, code: string) {
  const body = [
    "Dhapti University",
    "Official Student Form",
    "",
    `Form: ${title}`,
    `Code: ${code}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "Complete this form and submit to the relevant office.",
    "This downloadable copy is provided for student records.",
  ].join("\n");

  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `DHAPTI-${code}-${title.replace(/\s+/g, "-")}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast.success(`${title} downloaded`);
}

export function StudentDownloadFormsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002147] md:text-3xl">
          Download Forms
        </h1>
        <p className="mt-2 text-muted-foreground">
          Official university forms available for download and submission.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {forms.map((form) => (
          <div
            key={form.id}
            className="group relative overflow-hidden rounded-2xl bg-[#0B3D2E] p-6 text-white shadow-lg transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#16a34a]/30" />
            <div className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-[#F68F3A]/20" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <FileText className="h-6 w-6 text-[#86efac]" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#86efac]">
                {form.code}
              </p>
              <h2 className="mt-2 text-lg font-bold">{form.title}</h2>
              <p className="mt-2 text-sm font-medium text-slate-200">
                {form.description}
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="mt-5 bg-[#16a34a] text-white hover:bg-[#15803d]">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{form.title}</DialogTitle>
                    <DialogDescription>
                      Download the official {form.title} ({form.code}) for
                      printing and submission to the registrar or relevant
                      office.
                    </DialogDescription>
                  </DialogHeader>
                  <Button
                    className="bg-[#002147] text-white hover:bg-[#003366]"
                    onClick={() => downloadFormPdf(form.title, form.code)}
                  >
                    <Download className="h-4 w-4" />
                    Save PDF
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
