import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  CreditCard,
  Inbox,
  LifeBuoy,
  Mail,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { studentIdentity } from "@/data/studentPortal";

export function StudentAccountDetailsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Header
        title="Account Details"
        description="Student billing ledger and payment account information."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-[#E5EBF3]">
          <CardContent className="space-y-3 p-6">
            <CreditCard className="h-8 w-8 text-[#E85D04]" />
            <Field label="Account Name" value={studentIdentity.name} />
            <Field label="Student ID" value={studentIdentity.id} />
            <Field label="Ledger No" value="BLG-CS-88214" />
            <Field label="Bank" value="Salaam Bank — Dhapti Collection A/C" />
          </CardContent>
        </Card>
        <Card className="border-[#E5EBF3]">
          <CardContent className="space-y-3 p-6">
            <Field label="Account Status" value="Active" />
            <Field label="Last Payment" value="$1,200.00 · Jul 10, 2026" />
            <Field label="Payment Method" value="Bank Transfer / Mobile Money" />
            <Field label="Finance Officer" value="Hodan Ismail" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function StudentHostelFeesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Header
        title="Hostel Fees"
        description="Residence hall charges for the current academic year."
      />
      <Card className="border-[#E5EBF3]">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <Stat label="Room Type" value="Double Sharing" />
          <Stat label="Semester Fee" value="$350" />
          <Stat label="Balance Due" value="$100" tone="text-[#E85D04]" />
        </CardContent>
      </Card>
      <Card className="border-[#E5EBF3]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="pl-6">Invoice</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["HST-2501", "Spring 2026", "$350", "Paid"],
                ["HST-2502", "Fall 2026", "$350", "Partial"],
              ].map(([invoice, period, amount, status]) => (
                <TableRow key={invoice}>
                  <TableCell className="pl-6 font-semibold text-slate-900 dark:text-white">
                    {invoice}
                  </TableCell>
                  <TableCell>{period}</TableCell>
                  <TableCell>{amount}</TableCell>
                  <TableCell className="pr-6">
                    <Badge variant={status === "Paid" ? "success" : "warning"}>
                      {status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentImprovementResultPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Header
        title="Improvement Result"
        description="Published results for improvement / retake examinations."
      />
      <Card className="border-[#E5EBF3]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="pl-6">Course</TableHead>
                <TableHead>Previous Grade</TableHead>
                <TableHead>Improved Grade</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="pl-6 font-semibold text-slate-900 dark:text-white">
                  CSC-320 Computer Networks
                </TableCell>
                <TableCell>B+</TableCell>
                <TableCell className="font-bold text-[#16a34a]">A-</TableCell>
                <TableCell className="pr-6">
                  <Badge variant="success">Updated</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 font-semibold text-[#002147]">
                  ENG-205 Academic Writing
                </TableCell>
                <TableCell>B</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="pr-6">
                  <Badge variant="warning">Pending</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentEligibleSubjectsPage() {
  const [applied, setApplied] = useState<Set<string>>(new Set());

  function applyForCourse(code: string, title: string) {
    setApplied((prev) => new Set(prev).add(code));
    toast.success(`Improvement application submitted for ${code} — ${title}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Header
        title="Eligible Subject"
        description="Courses you are eligible to improve this exam window."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { code: "CSC-320", title: "Computer Networks", fee: "$40" },
          { code: "ENG-205", title: "Academic Writing", fee: "$35" },
          { code: "MTH-210", title: "Discrete Mathematics", fee: "$40" },
        ].map((course) => {
          const isApplied = applied.has(course.code);
          return (
            <Card key={course.code} className="border-[#E5EBF3]">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#E85D04]" />
                    <Badge variant="info">{course.code}</Badge>
                  </div>
                  <p className="font-semibold text-[#002147]">{course.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Improvement fee: {course.fee}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={isApplied}
                  className="bg-[#16a34a] text-white hover:bg-[#15803d]"
                  onClick={() => applyForCourse(course.code, course.title)}
                >
                  {isApplied ? "Applied" : "Apply"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function StudentMailPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Header
        title="Mail Account"
        description="University email credentials and inbox status."
      />
      <Card className="border-[#E5EBF3]">
        <CardContent className="space-y-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#002147]/10 text-[#002147]">
            <Mail className="h-6 w-6" />
          </div>
          <Field label="University Email" value={studentIdentity.email} />
          <Field label="Alias" value="ahmed.m@students.biu.edu.so" />
          <Field label="Quota Used" value="2.1 GB / 15 GB" />
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Active</Badge>
            <Badge variant="info">IMAP / SMTP Enabled</Badge>
          </div>
          <Button
            className="bg-[#002147] text-white hover:bg-[#003366]"
            onClick={() => {
              window.open("https://mail.google.com/", "_blank", "noopener,noreferrer");
              toast.message("Opening university webmail…");
            }}
          >
            <Inbox className="h-4 w-4" />
            Open Webmail
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentSupportTicketPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Support ticket TCK-2481 submitted successfully");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Header
        title="Support Ticket"
        description="Raise an IT, academic, or finance support request."
      />
      <Card className="border-[#E5EBF3]">
        <CardHeader className="border-b border-[#E5EBF3] pb-3">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-[#E85D04]" />
            <h2 className="font-bold text-[#002147]">New Ticket</h2>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category
              </span>
              <Select defaultValue="Academic">
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Academic">Academic</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="IT / Portal">IT / Portal</SelectItem>
                  <SelectItem value="Hostel">Hostel</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subject
              </span>
              <Input
                required
                placeholder="Brief summary of your issue"
                className="h-10 rounded-xl border-[#E5EBF3] bg-white font-semibold text-[#002147] placeholder:text-slate-600"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Description
              </span>
              <textarea
                required
                rows={5}
                className="w-full rounded-xl border border-[#E5EBF3] bg-white px-3 py-2.5 text-sm font-semibold text-[#002147] outline-none placeholder:font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-[#16a34a]/20"
                placeholder="Describe your issue in detail..."
              />
            </label>
            {submitted && (
              <div className="flex items-center gap-2 text-sm font-medium text-[#16a34a]">
                <CheckCircle2 className="h-4 w-4" />
                Ticket TCK-2481 submitted successfully.
              </div>
            )}
            <Button type="submit" className="bg-[#16a34a] text-white hover:bg-[#15803d]">
              Submit Ticket
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#002147] md:text-3xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold text-[#002147]">{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold text-[#002147] ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
