import { useMemo, useState } from "react";
import { CalendarDays, Clock, MapPin, UserRound } from "lucide-react";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DayKey = "Saturday" | "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday";

type Slot = {
  time: string;
  code: string;
  name: string;
  lecturer: string;
  room: string;
};

const DAYS: DayKey[] = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
];

const SLOT_TIMES = [
  "08:00 AM - 10:00 AM",
  "10:30 AM - 12:30 PM",
  "02:00 PM - 04:00 PM",
] as const;

const weeklyRoutine: Record<DayKey, Slot[]> = {
  Saturday: [
    {
      time: SLOT_TIMES[0],
      code: "CSC-301",
      name: "Data Structures",
      lecturer: "Prof. Mohamed Ali",
      room: "Lab A-204",
    },
    {
      time: SLOT_TIMES[1],
      code: "CSC-305",
      name: "Database Systems",
      lecturer: "Dr. Amina Yusuf",
      room: "Hall B-112",
    },
    {
      time: SLOT_TIMES[2],
      code: "MAT-210",
      name: "Discrete Mathematics",
      lecturer: "Mr. Abdi Hassan",
      room: "Room C-018",
    },
  ],
  Sunday: [
    {
      time: SLOT_TIMES[0],
      code: "CSC-310",
      name: "Software Engineering",
      lecturer: "Prof. Hassan Nur",
      room: "Hall B-210",
    },
    {
      time: SLOT_TIMES[1],
      code: "CSC-320",
      name: "Computer Networks",
      lecturer: "Ms. Fadumo Omar",
      room: "Lab A-301",
    },
    {
      time: SLOT_TIMES[2],
      code: "ENG-101",
      name: "Academic English",
      lecturer: "Ms. Sahra Abdi",
      room: "Room D-012",
    },
  ],
  Monday: [
    {
      time: SLOT_TIMES[0],
      code: "CSC-301",
      name: "Data Structures",
      lecturer: "Prof. Mohamed Ali",
      room: "Lab A-204",
    },
    {
      time: SLOT_TIMES[1],
      code: "CSC-330",
      name: "Operating Systems",
      lecturer: "Dr. Omar Warsame",
      room: "Lab A-118",
    },
    {
      time: SLOT_TIMES[2],
      code: "CSC-305",
      name: "Database Systems",
      lecturer: "Dr. Amina Yusuf",
      room: "Hall B-112",
    },
  ],
  Tuesday: [
    {
      time: SLOT_TIMES[0],
      code: "CSC-320",
      name: "Computer Networks",
      lecturer: "Ms. Fadumo Omar",
      room: "Lab A-301",
    },
    {
      time: SLOT_TIMES[1],
      code: "CSC-310",
      name: "Software Engineering",
      lecturer: "Prof. Hassan Nur",
      room: "Hall B-210",
    },
    {
      time: SLOT_TIMES[2],
      code: "ISL-110",
      name: "Islamic Studies",
      lecturer: "Sheikh Yusuf Aden",
      room: "Room E-001",
    },
  ],
  Wednesday: [
    {
      time: SLOT_TIMES[0],
      code: "CSC-330",
      name: "Operating Systems",
      lecturer: "Dr. Omar Warsame",
      room: "Lab A-118",
    },
    {
      time: SLOT_TIMES[1],
      code: "MAT-210",
      name: "Discrete Mathematics",
      lecturer: "Mr. Abdi Hassan",
      room: "Room C-018",
    },
    {
      time: SLOT_TIMES[2],
      code: "CSC-340",
      name: "Web Technologies Lab",
      lecturer: "Ms. Halima Farah",
      room: "Lab ICT-02",
    },
  ],
  Thursday: [
    {
      time: SLOT_TIMES[0],
      code: "CSC-340",
      name: "Web Technologies Lab",
      lecturer: "Ms. Halima Farah",
      room: "Lab ICT-02",
    },
    {
      time: SLOT_TIMES[1],
      code: "ENG-101",
      name: "Academic English",
      lecturer: "Ms. Sahra Abdi",
      room: "Room D-012",
    },
    {
      time: SLOT_TIMES[2],
      code: "CSC-301",
      name: "Data Structures Tutorial",
      lecturer: "Prof. Mohamed Ali",
      room: "Tutorial Hall T-3",
    },
  ],
};

const dayShort: Record<DayKey | "All", string> = {
  All: "All Days",
  Saturday: "Sat",
  Sunday: "Sun",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
};

export function StudentRoutinePage() {
  const [filter, setFilter] = useState<DayKey | "All">("All");

  const daysToShow = useMemo(
    () => (filter === "All" ? DAYS : [filter]),
    [filter]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Class Routine"
        description="Full weekly timetable — Saturday through Thursday with morning, mid-day, and afternoon slots."
      />

      <div className="flex flex-wrap gap-2">
        {(["All", ...DAYS] as const).map((day) => {
          const active = filter === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setFilter(day)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
                active
                  ? "bg-[#002147] text-white shadow-sm"
                  : "border border-[#E5EBF3] bg-white text-[#002147] hover:border-[#ea580c] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              )}
            >
              {dayShort[day]}
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        {daysToShow.map((day) => (
          <Card
            key={day}
            className="overflow-hidden border-[#E5EBF3] shadow-sm dark:border-slate-800"
          >
            <CardHeader className="flex flex-row items-center gap-2 border-b border-[#E5EBF3] bg-[#F4F7FB] py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <CalendarDays className="h-5 w-5 text-[#ea580c]" />
              <h2 className="text-base font-bold text-[#002147] dark:text-white">
                {day}
              </h2>
              <Badge variant="info" className="ml-auto">
                {weeklyRoutine[day].length} sessions
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              {weeklyRoutine[day].map((slot) => (
                <article
                  key={`${day}-${slot.time}-${slot.code}`}
                  className="rounded-2xl border border-[#E5EBF3] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="mb-3 flex items-center gap-2 text-[#ea580c]">
                    <Clock className="h-4 w-4" />
                    <p className="text-xs font-bold uppercase tracking-wide">
                      {slot.time}
                    </p>
                  </div>
                  <p className="text-sm font-black text-[#002147] dark:text-white">
                    {slot.code}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {slot.name}
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <p className="flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 text-[#002147] dark:text-slate-200" />
                      {slot.lecturer}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#002147] dark:text-slate-200" />
                      {slot.room}
                    </p>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
