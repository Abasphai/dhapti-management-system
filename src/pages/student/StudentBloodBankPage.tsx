import { useMemo, useState, type FormEvent } from "react";
import { Droplets, Phone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

const BLOOD_GROUPS = [
  "O+",
  "O-",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
] as const;

type BloodGroup = (typeof BLOOD_GROUPS)[number];

type UrgentRequest = {
  id: string;
  bloodGroup: BloodGroup;
  hospital: string;
  location: string;
  unitsNeeded: number;
  emergencyContact: string;
};

type CampusDonor = {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  faculty: string;
  lastDonated: string;
  phone: string;
};

const URGENT_REQUESTS: UrgentRequest[] = [
  {
    id: "req-biu",
    bloodGroup: "O+",
    hospital: "Dhapti Medical Center",
    location: "Dhapti Campus Clinic, Block C — Dhapti",
    unitsNeeded: 2,
    emergencyContact: "+252 61 700 1122",
  },
  {
    id: "req-banadir",
    bloodGroup: "B+",
    hospital: "Banadir Hospital",
    location: "Banadir Hospital Emergency Ward — Mogadishu",
    unitsNeeded: 1,
    emergencyContact: "+252 61 555 9080",
  },
];

const INITIAL_DONORS: CampusDonor[] = [
  {
    id: "d1",
    name: "Amina Hassan Ali",
    bloodGroup: "O+",
    faculty: "Faculty of Medicine",
    lastDonated: "2026-05-12",
    phone: "+252 61 111 2200",
  },
  {
    id: "d2",
    name: "Abdiqani Yusuf Omar",
    bloodGroup: "B+",
    faculty: "Faculty of Computing & IT",
    lastDonated: "2026-06-01",
    phone: "+252 61 222 3300",
  },
  {
    id: "d3",
    name: "Fadumo Abdirahman",
    bloodGroup: "A+",
    faculty: "Faculty of Business",
    lastDonated: "2026-03-20",
    phone: "+252 61 333 4400",
  },
  {
    id: "d4",
    name: "Ibrahim Mohamed Nur",
    bloodGroup: "O-",
    faculty: "Faculty of Medicine",
    lastDonated: "2026-07-08",
    phone: "+252 61 444 5500",
  },
  {
    id: "d5",
    name: "Sahra Abdullahi",
    bloodGroup: "AB+",
    faculty: "Faculty of Education",
    lastDonated: "Never",
    phone: "+252 61 555 6600",
  },
  {
    id: "d6",
    name: "Hassan Farah Warsame",
    bloodGroup: "A-",
    faculty: "Faculty of Computing & IT",
    lastDonated: "2026-04-15",
    phone: "+252 61 666 7700",
  },
];

function formatDisplayDate(value: string) {
  if (!value || value === "Never" || value === "Not recorded") return value || "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StudentBloodBankPage() {
  const [registered, setRegistered] = useState(false);
  const [myGroup, setMyGroup] = useState<BloodGroup>(
    (studentIdentity.bloodGroup as BloodGroup) || "O+"
  );
  const [lastDonationLabel, setLastDonationLabel] = useState("Not recorded");
  const [donors, setDonors] = useState<CampusDonor[]>(INITIAL_DONORS);
  const [filterGroup, setFilterGroup] = useState<string>("All");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [regGroup, setRegGroup] = useState<BloodGroup>(myGroup);
  const [regPhone, setRegPhone] = useState(studentIdentity.phone || "");
  const [regLastDonation, setRegLastDonation] = useState("");
  const [regConsent, setRegConsent] = useState(false);

  const [respondOpen, setRespondOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<UrgentRequest | null>(
    null
  );

  const filteredDonors = useMemo(() => {
    if (filterGroup === "All") return donors;
    return donors.filter((d) => d.bloodGroup === filterGroup);
  }, [donors, filterGroup]);

  function openRegister() {
    setRegGroup(myGroup);
    setRegPhone(studentIdentity.phone || "");
    setRegLastDonation("");
    setRegConsent(false);
    setRegisterOpen(true);
  }

  function submitRegister(e: FormEvent) {
    e.preventDefault();
    if (!regConsent) {
      toast.error("Please agree to be contacted for emergency requests.");
      return;
    }
    if (!regPhone.trim()) {
      toast.error("Phone number is required.");
      return;
    }

    const lastLabel = regLastDonation
      ? formatDisplayDate(regLastDonation)
      : "Never";

    setRegistered(true);
    setMyGroup(regGroup);
    setLastDonationLabel(lastLabel);

    setDonors((prev) => {
      const existing = prev.findIndex(
        (d) => d.name === studentIdentity.name || d.id === "me"
      );
      const entry: CampusDonor = {
        id: "me",
        name: studentIdentity.name,
        bloodGroup: regGroup,
        faculty: studentIdentity.faculty,
        lastDonated: lastLabel,
        phone: regPhone.trim(),
      };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = entry;
        return next;
      }
      return [entry, ...prev];
    });

    setRegisterOpen(false);
    toast.success(
      "You have successfully registered as an active campus blood donor!"
    );
  }

  function openRespond(request: UrgentRequest) {
    setActiveRequest(request);
    setRespondOpen(true);
  }

  function confirmRespond() {
    if (!activeRequest) return;
    setRespondOpen(false);
    setActiveRequest(null);
    toast.success(
      "Thank you! The medical center has been notified of your response."
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002147] md:text-3xl">
          Blood Bank
        </h1>
        <p className="mt-2 text-muted-foreground">
          Campus blood donor registry and emergency requests.
        </p>
      </div>

      <Card className="border-[#E5EBF3]">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <Droplets className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-[#002147]">Your Blood Group</p>
              <p className="text-2xl font-bold text-red-600">{myGroup}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Last donation: {lastDonationLabel} ·{" "}
                {registered ? "Registered donor" : "Eligible to donate"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={openRegister}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {registered ? "Update Donor Profile" : "Register as Donor"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[#E5EBF3]">
        <CardHeader className="border-b border-[#E5EBF3] pb-3">
          <h2 className="font-bold text-[#002147]">Urgent Requests</h2>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {URGENT_REQUESTS.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-xl border border-[#E5EBF3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Badge variant="danger">{request.bloodGroup}</Badge>
                <p className="mt-1 font-semibold text-[#002147]">
                  {request.hospital}
                </p>
                <p className="text-xs text-muted-foreground">
                  {request.unitsNeeded} unit
                  {request.unitsNeeded === 1 ? "" : "s"} needed ·{" "}
                  {request.location}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-[#E5EBF3]"
                onClick={() => openRespond(request)}
              >
                Respond
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[#E5EBF3]">
        <CardHeader className="flex flex-col gap-3 border-b border-[#E5EBF3] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-[#002147]">Campus Blood Donors</h2>
          <div className="w-full sm:w-44">
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="h-10 rounded-xl border-[#E5EBF3]">
                <SelectValue placeholder="Blood group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {BLOOD_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
                <TableHead className="pl-6">Student Name</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Last Donated</TableHead>
                <TableHead className="pr-6 text-right">Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonors.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No donors found for this blood group.
                  </TableCell>
                </TableRow>
              )}
              {filteredDonors.map((donor) => (
                <TableRow key={donor.id}>
                  <TableCell className="pl-6 font-semibold text-[#002147]">
                    {donor.name}
                    {donor.id === "me" && (
                      <Badge variant="success" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="danger">{donor.bloodGroup}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {donor.faculty}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDisplayDate(donor.lastDonated)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[#E5EBF3]"
                      onClick={() => {
                        toast.message(`Contact ${donor.name}`, {
                          description: donor.phone,
                        });
                      }}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Contact
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Register as Donor */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent
          className={cn(
            "flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden",
            "rounded-[28px] bg-white p-0 text-[#002147] shadow-2xl sm:rounded-[28px]",
            "dark:bg-white dark:text-[#002147]"
          )}
        >
          <form
            onSubmit={submitRegister}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-2 pt-6 md:px-8 md:pt-8">
              <DialogHeader className="pr-8">
                <DialogTitle className="text-[#002147]">
                  Register as Donor
                </DialogTitle>
                <DialogDescription className="text-slate-500">
                  Join the Dhapti campus blood donor registry for emergency
                  response.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Blood Group
                  </span>
                  <Select
                    value={regGroup}
                    onValueChange={(v) => setRegGroup(v as BloodGroup)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-11 rounded-xl border-slate-200 bg-white",
                        "font-bold text-[#002147] dark:bg-white dark:text-[#002147]"
                      )}
                    >
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-[#002147]">
                      {BLOOD_GROUPS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Phone Number
                  </span>
                  <Input
                    required
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+252 61 000 0000"
                    className={cn(
                      "h-11 rounded-xl border border-slate-200 bg-white",
                      "font-bold text-[#002147] placeholder:font-medium placeholder:text-slate-400",
                      "caret-[#002147] dark:bg-white dark:text-[#002147]",
                      "focus-visible:ring-[#16a34a]/30"
                    )}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Last Donation Date
                  </span>
                  <Input
                    type="date"
                    value={regLastDonation}
                    onChange={(e) => setRegLastDonation(e.target.value)}
                    style={{ colorScheme: "light" }}
                    className={cn(
                      "h-11 rounded-xl border border-slate-200 bg-white",
                      "font-bold text-[#002147]",
                      "dark:bg-white dark:text-[#002147]",
                      "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                      "[&::-webkit-calendar-picker-indicator]:opacity-100",
                      "[&::-webkit-calendar-picker-indicator]:brightness-0",
                      "[&::-webkit-datetime-edit]:text-[#002147]",
                      "[&::-webkit-datetime-edit-fields-wrapper]:text-[#002147]",
                      "[&::-webkit-datetime-edit-text]:text-slate-500",
                      "[&::-webkit-datetime-edit-month-field]:text-[#002147]",
                      "[&::-webkit-datetime-edit-day-field]:text-[#002147]",
                      "[&::-webkit-datetime-edit-year-field]:text-[#002147]",
                      "focus-visible:ring-[#16a34a]/30"
                    )}
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={regConsent}
                    onChange={(e) => setRegConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-red-600"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    I agree to be contacted for emergency campus blood requests.
                  </span>
                </label>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 md:px-8">
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setRegisterOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-6 py-2.5 font-bold text-[#002147] transition-all hover:bg-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-red-600 px-8 py-2.5 font-bold text-white shadow-lg transition-all hover:bg-red-700 active:scale-95"
                >
                  Register
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Respond to Request */}
      <Dialog
        open={respondOpen}
        onOpenChange={(open) => {
          setRespondOpen(open);
          if (!open) setActiveRequest(null);
        }}
      >
        <DialogContent
          className={cn(
            "flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden",
            "rounded-[28px] bg-white p-0 text-[#002147] shadow-2xl sm:rounded-[28px]",
            "dark:bg-white dark:text-[#002147]"
          )}
        >
          {activeRequest && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-2 pt-6 md:px-8 md:pt-8">
                <DialogHeader className="pr-8">
                  <DialogTitle className="text-[#002147]">
                    Respond to Request
                  </DialogTitle>
                  <DialogDescription className="text-slate-500">
                    Confirm your availability for this urgent blood request.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="danger">{activeRequest.bloodGroup}</Badge>
                    <p className="font-bold text-[#002147]">
                      {activeRequest.hospital}
                    </p>
                  </div>
                  <FieldRow
                    label="Hospital Location"
                    value={activeRequest.location}
                  />
                  <FieldRow
                    label="Units Needed"
                    value={`${activeRequest.unitsNeeded} unit${
                      activeRequest.unitsNeeded === 1 ? "" : "s"
                    }`}
                  />
                  <FieldRow
                    label="Emergency Contact"
                    value={activeRequest.emergencyContact}
                  />
                </div>
              </div>
              <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 md:px-8">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button
                    type="button"
                    onClick={() => setRespondOpen(false)}
                    className="rounded-xl border border-slate-200 bg-slate-100 px-6 py-2.5 font-bold text-[#002147] transition-all hover:bg-slate-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmRespond}
                    className="rounded-xl bg-red-600 px-8 py-2.5 font-bold text-white shadow-lg transition-all hover:bg-red-700 active:scale-95"
                  >
                    Confirm Donation Response
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm font-bold text-[#002147]">
        {value}
      </p>
    </div>
  );
}
