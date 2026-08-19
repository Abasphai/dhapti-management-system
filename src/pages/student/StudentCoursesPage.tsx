import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  Clock3,
  Library,
  Lock,
  MapPin,
  MessageSquare,
  Star,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/portals";
import {
  AskQuestionModal,
  type AskQuestionCourse,
} from "@/components/student/AskQuestionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function semesterNumber(label: string): number {
  const match = /Semester\s+(\d+)/i.exec(label.trim());
  return match ? Number(match[1]) : 0;
}

type SemesterKey =
  | "Semester 1"
  | "Semester 2"
  | "Semester 3"
  | "Semester 4"
  | "Semester 5"
  | "Semester 6"
  | "Semester 7"
  | "Semester 8";

interface CourseCatalogItem {
  code: string;
  title: string;
  credits: number;
  lecturer: string;
  schedule: string;
  room: string;
  progress: number;
}

const SEMESTERS: SemesterKey[] = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8",
];

const COURSES_BY_SEMESTER: Record<SemesterKey, CourseCatalogItem[]> = {
  "Semester 1": [
    {
      code: "CS101",
      title: "Introduction to Computing",
      credits: 3,
      lecturer: "Prof. Amina Hassan",
      schedule: "Sat / Mon 08:00 - 10:00",
      room: "Hall 101",
      progress: 100,
    },
    {
      code: "CS102",
      title: "Programming Fundamentals I",
      credits: 4,
      lecturer: "Dr. Omar Farah",
      schedule: "Sun / Tue 10:00 - 12:00",
      room: "Lab 01",
      progress: 100,
    },
    {
      code: "MTH101",
      title: "Calculus I",
      credits: 3,
      lecturer: "Prof. Leyla Yusuf",
      schedule: "Sat / Wed 14:00 - 16:00",
      room: "Hall 204",
      progress: 100,
    },
    {
      code: "ENG101",
      title: "Academic English",
      credits: 3,
      lecturer: "Ms. Fatima Abdi",
      schedule: "Mon / Thu 08:00 - 10:00",
      room: "Room 12",
      progress: 100,
    },
    {
      code: "PHY101",
      title: "Physics for Computing",
      credits: 3,
      lecturer: "Dr. Said Nur",
      schedule: "Tue / Thu 12:00 - 14:00",
      room: "Lab 03",
      progress: 100,
    },
  ],
  "Semester 2": [
    {
      code: "CS103",
      title: "Programming Fundamentals II",
      credits: 4,
      lecturer: "Dr. Omar Farah",
      schedule: "Sat / Mon 08:00 - 10:00",
      room: "Lab 02",
      progress: 100,
    },
    {
      code: "CS110",
      title: "Discrete Mathematics",
      credits: 3,
      lecturer: "Prof. Leyla Yusuf",
      schedule: "Sun / Wed 10:00 - 12:00",
      room: "Hall 104",
      progress: 100,
    },
    {
      code: "CS120",
      title: "Digital Logic Design",
      credits: 3,
      lecturer: "Eng. Hassan Ali",
      schedule: "Mon / Thu 14:00 - 16:00",
      room: "Lab 04",
      progress: 100,
    },
    {
      code: "MTH102",
      title: "Linear Algebra",
      credits: 3,
      lecturer: "Prof. Amina Hassan",
      schedule: "Tue / Thu 08:00 - 10:00",
      room: "Hall 205",
      progress: 100,
    },
    {
      code: "ISL101",
      title: "Islamic Studies",
      credits: 2,
      lecturer: "Sh. Mohamed Ibrahim",
      schedule: "Wed 12:00 - 14:00",
      room: "Hall 01",
      progress: 100,
    },
    {
      code: "COM101",
      title: "Communication Skills",
      credits: 3,
      lecturer: "Ms. Fatima Abdi",
      schedule: "Sat / Tue 16:00 - 18:00",
      room: "Room 08",
      progress: 100,
    },
  ],
  "Semester 3": [
    {
      code: "CS201",
      title: "Object-Oriented Programming",
      credits: 4,
      lecturer: "Dr. Omar Farah",
      schedule: "Sat / Mon 08:00 - 10:00",
      room: "Lab 02",
      progress: 100,
    },
    {
      code: "CS210",
      title: "Computer Organization",
      credits: 3,
      lecturer: "Eng. Hassan Ali",
      schedule: "Sun / Wed 10:00 - 12:00",
      room: "Hall 110",
      progress: 100,
    },
    {
      code: "CS220",
      title: "Database Fundamentals",
      credits: 3,
      lecturer: "Prof. Nadia Warsame",
      schedule: "Mon / Thu 14:00 - 16:00",
      room: "Lab 05",
      progress: 100,
    },
    {
      code: "CS230",
      title: "Web Development I",
      credits: 3,
      lecturer: "Mr. Abdiwali Jama",
      schedule: "Tue / Thu 08:00 - 10:00",
      room: "Lab 01",
      progress: 100,
    },
    {
      code: "MTH201",
      title: "Discrete Math II",
      credits: 3,
      lecturer: "Prof. Leyla Yusuf",
      schedule: "Sat / Wed 12:00 - 14:00",
      room: "Hall 104",
      progress: 100,
    },
  ],
  "Semester 4": [
    {
      code: "CS305",
      title: "Database Systems",
      credits: 3,
      lecturer: "Prof. Nadia Warsame",
      schedule: "Mon / Wed 08:00 - 10:00",
      room: "Lab 05",
      progress: 72,
    },
    {
      code: "CS401",
      title: "Software Engineering",
      credits: 3,
      lecturer: "Dr. Omar Farah",
      schedule: "Sat / Tue 10:00 - 12:00",
      room: "Hall 210",
      progress: 65,
    },
    {
      code: "CS301",
      title: "Data Structures & Algorithms",
      credits: 3,
      lecturer: "Eng. Hassan Ali",
      schedule: "Sun / Thu 08:00 - 10:00",
      room: "Lab 02",
      progress: 80,
    },
    {
      code: "CS320",
      title: "Computer Networks",
      credits: 3,
      lecturer: "Prof. Amina Hassan",
      schedule: "Mon / Wed 14:00 - 16:00",
      room: "Hall 118",
      progress: 58,
    },
    {
      code: "CS310",
      title: "Web Development II",
      credits: 3,
      lecturer: "Mr. Abdiwali Jama",
      schedule: "Tue / Thu 12:00 - 14:00",
      room: "Lab 01",
      progress: 70,
    },
    {
      code: "MTH202",
      title: "Probability & Statistics",
      credits: 3,
      lecturer: "Prof. Leyla Yusuf",
      schedule: "Sat / Wed 16:00 - 18:00",
      room: "Hall 204",
      progress: 62,
    },
  ],
  "Semester 5": [
    {
      code: "CS410",
      title: "Operating Systems",
      credits: 3,
      lecturer: "Eng. Hassan Ali",
      schedule: "Sat / Mon 08:00 - 10:00",
      room: "Hall 220",
      progress: 40,
    },
    {
      code: "CS420",
      title: "Mobile App Development",
      credits: 3,
      lecturer: "Mr. Abdiwali Jama",
      schedule: "Sun / Tue 10:00 - 12:00",
      room: "Lab 06",
      progress: 35,
    },
    {
      code: "CS430",
      title: "Human–Computer Interaction",
      credits: 3,
      lecturer: "Ms. Fatima Abdi",
      schedule: "Mon / Thu 14:00 - 16:00",
      room: "Room 15",
      progress: 28,
    },
    {
      code: "CS440",
      title: "Information Security Basics",
      credits: 3,
      lecturer: "Dr. Said Nur",
      schedule: "Tue / Wed 08:00 - 10:00",
      room: "Lab 03",
      progress: 32,
    },
    {
      code: "CS450",
      title: "Advanced Databases",
      credits: 3,
      lecturer: "Prof. Nadia Warsame",
      schedule: "Sat / Thu 12:00 - 14:00",
      room: "Lab 05",
      progress: 45,
    },
  ],
  "Semester 6": [
    {
      code: "CS510",
      title: "Artificial Intelligence",
      credits: 3,
      lecturer: "Dr. Omar Farah",
      schedule: "Sat / Mon 10:00 - 12:00",
      room: "Hall 301",
      progress: 15,
    },
    {
      code: "CS520",
      title: "Cloud Computing",
      credits: 3,
      lecturer: "Eng. Hassan Ali",
      schedule: "Sun / Wed 08:00 - 10:00",
      room: "Lab 07",
      progress: 20,
    },
    {
      code: "CS530",
      title: "Software Project Management",
      credits: 3,
      lecturer: "Prof. Amina Hassan",
      schedule: "Mon / Thu 14:00 - 16:00",
      room: "Hall 215",
      progress: 18,
    },
    {
      code: "CS540",
      title: "Machine Learning Foundations",
      credits: 4,
      lecturer: "Dr. Said Nur",
      schedule: "Tue / Thu 10:00 - 12:00",
      room: "Lab 08",
      progress: 12,
    },
    {
      code: "CS550",
      title: "Distributed Systems",
      credits: 3,
      lecturer: "Prof. Nadia Warsame",
      schedule: "Sat / Wed 16:00 - 18:00",
      room: "Hall 118",
      progress: 10,
    },
    {
      code: "RES501",
      title: "Research Methods",
      credits: 3,
      lecturer: "Prof. Leyla Yusuf",
      schedule: "Wed 12:00 - 14:00",
      room: "Room 20",
      progress: 22,
    },
  ],
  "Semester 7": [
    {
      code: "CS610",
      title: "Big Data Analytics",
      credits: 3,
      lecturer: "Dr. Omar Farah",
      schedule: "Sat / Mon 08:00 - 10:00",
      room: "Lab 09",
      progress: 0,
    },
    {
      code: "CS620",
      title: "Cybersecurity Operations",
      credits: 3,
      lecturer: "Dr. Said Nur",
      schedule: "Sun / Tue 10:00 - 12:00",
      room: "Lab 03",
      progress: 0,
    },
    {
      code: "CS630",
      title: "DevOps & CI/CD",
      credits: 3,
      lecturer: "Mr. Abdiwali Jama",
      schedule: "Mon / Wed 14:00 - 16:00",
      room: "Lab 01",
      progress: 0,
    },
    {
      code: "CS640",
      title: "Enterprise Architecture",
      credits: 3,
      lecturer: "Prof. Amina Hassan",
      schedule: "Tue / Thu 08:00 - 10:00",
      room: "Hall 310",
      progress: 0,
    },
    {
      code: "PRJ701",
      title: "Capstone Project I",
      credits: 4,
      lecturer: "Eng. Hassan Ali",
      schedule: "Wed 10:00 - 13:00",
      room: "Project Hub",
      progress: 0,
    },
  ],
  "Semester 8": [
    {
      code: "CS710",
      title: "Advanced Topics in Computing",
      credits: 3,
      lecturer: "Prof. Nadia Warsame",
      schedule: "Sat / Mon 10:00 - 12:00",
      room: "Hall 320",
      progress: 0,
    },
    {
      code: "CS720",
      title: "Professional Ethics in IT",
      credits: 2,
      lecturer: "Ms. Fatima Abdi",
      schedule: "Sun 14:00 - 16:00",
      room: "Room 12",
      progress: 0,
    },
    {
      code: "CS730",
      title: "Internet of Things",
      credits: 3,
      lecturer: "Eng. Hassan Ali",
      schedule: "Mon / Wed 08:00 - 10:00",
      room: "Lab 10",
      progress: 0,
    },
    {
      code: "CS740",
      title: "IT Entrepreneurship",
      credits: 3,
      lecturer: "Prof. Amina Hassan",
      schedule: "Tue / Thu 12:00 - 14:00",
      room: "Hall 210",
      progress: 0,
    },
    {
      code: "PRJ702",
      title: "Capstone Project II",
      credits: 4,
      lecturer: "Dr. Omar Farah",
      schedule: "Wed 10:00 - 13:00",
      room: "Project Hub",
      progress: 0,
    },
    {
      code: "INT801",
      title: "Industry Internship",
      credits: 3,
      lecturer: "Career Services Office",
      schedule: "Field placement",
      room: "Off Campus",
      progress: 0,
    },
  ],
};

export function StudentCoursesPage() {
  const [semester, setSemester] = useState<SemesterKey>("Semester 4");
  const [currentSemester, setCurrentSemester] =
    useState<SemesterKey>("Semester 4");
  const [submittedCourseCodes, setSubmittedCourseCodes] = useState<Set<string>>(
    new Set()
  );
  const [enrollmentByCode, setEnrollmentByCode] = useState<
    Map<string, AskQuestionCourse>
  >(new Map());
  const [askOpen, setAskOpen] = useState(false);
  const [askCourse, setAskCourse] = useState<AskQuestionCourse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await api<{ semester?: string }>("/students/me");
        const active = (profile.semester || "Semester 4") as SemesterKey;
        if (SEMESTERS.includes(active)) {
          setCurrentSemester(active);
          setSemester(active);
        }
      } catch {
        /* keep defaults */
      }
      try {
        const eligible = await api<{
          data: Array<{ courseCode: string; alreadyRated: boolean }>;
        }>("/ratings/eligible");
        setSubmittedCourseCodes(
          new Set(
            eligible.data
              .filter((r) => r.alreadyRated)
              .map((r) => r.courseCode)
          )
        );
      } catch {
        setSubmittedCourseCodes(new Set());
      }
      try {
        const enrollments = await api<{
          data: Array<{
            course: { id: string; code: string; title: string };
            teacher: { name?: string; fullName?: string };
          }>;
        }>("/students/me/enrollments");
        const map = new Map<string, AskQuestionCourse>();
        for (const row of enrollments.data ?? []) {
          const c = row.course;
          if (!c?.id || !c.code) continue;
          map.set(c.code.toUpperCase(), {
            courseId: c.id,
            code: c.code,
            title: c.title,
            lecturer: row.teacher?.fullName || row.teacher?.name || "Lecturer",
          });
        }
        setEnrollmentByCode(map);
      } catch {
        setEnrollmentByCode(new Map());
      }
    })();
  }, []);

  const courses = useMemo(
    () => COURSES_BY_SEMESTER[semester] ?? [],
    [semester]
  );
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  const viewingIdx = semesterNumber(semester);
  const currentIdx = semesterNumber(currentSemester);
  const evaluationWindow =
    viewingIdx === currentIdx
      ? "current"
      : viewingIdx < currentIdx
        ? "past"
        : "future";

  const openAskModal = (course: CourseCatalogItem) => {
    const enrolled = enrollmentByCode.get(course.code.toUpperCase());
    if (!enrolled) {
      toast.error(
        "Ask Lecturer is available for courses you are actively enrolled in."
      );
      return;
    }
    setAskCourse({
      ...enrolled,
      title: enrolled.title || course.title,
      lecturer: enrolled.lecturer || course.lecturer,
    });
    setAskOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="My Courses"
        description={`Computing & IT · ${semester} — ${courses.length} courses · ${totalCredits} credits · Active term: ${currentSemester}`}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-[#E5EBF3] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="px-1 text-xs font-bold uppercase tracking-wider text-[#002147]">
          Select Semester
        </p>
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {SEMESTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSemester(s)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
                semester === s
                  ? "bg-[#002147] text-white"
                  : "bg-[#F4F7FB] text-slate-600 hover:bg-[#002147]/10 hover:text-[#002147]"
              )}
            >
              {s.replace("Semester ", "Sem ")}
            </button>
          ))}
        </div>
        <div className="md:hidden">
          <Select
            value={semester}
            onValueChange={(v) => setSemester(v as SemesterKey)}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-[#E5EBF3]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course, index) => (
          <motion.div
            key={`${semester}-${course.code}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: index * 0.05,
              duration: 0.3,
              ease: "easeOut",
            }}
          >
            <Card className="group flex h-full flex-col border-[#E5EBF3] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <Badge
                    variant="secondary"
                    className="bg-[#E85D04]/10 text-[#E85D04] hover:bg-[#E85D04]/15"
                  >
                    {course.code}
                  </Badge>
                  <Badge variant="success">{course.credits} Credits</Badge>
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-snug text-[#002147]">
                    {course.title}
                  </h3>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5 text-[#16a34a]" />
                    {course.lecturer}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="mt-auto space-y-3 pb-5 text-xs text-muted-foreground">
                <p className="inline-flex items-center gap-1.5 font-medium text-[#002147]/80">
                  <Clock3 className="h-3.5 w-3.5 text-[#E85D04]" />
                  {course.schedule}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#002147]" />
                  {course.room}
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#002147]" />
                  {course.credits} credit hours
                </p>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-500">Course progress</span>
                    <span className="text-[#002147]">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>

                <Button
                  asChild
                  className="mt-1 w-full rounded-xl bg-[#002147] text-white hover:bg-[#16a34a]"
                >
                  <Link to="/student/education-materials">
                    <Library className="h-3.5 w-3.5" />
                    View Course Materials
                  </Link>
                </Button>
                {evaluationWindow === "current" &&
                submittedCourseCodes.has(course.code) ? (
                  <Badge className="w-full justify-center rounded-xl bg-[#16a34a] py-2 text-white hover:bg-[#16a34a]">
                    Evaluation Submitted
                  </Badge>
                ) : evaluationWindow === "current" ? (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl border-[#ea580c]/40 text-[#ea580c] hover:bg-[#ea580c]/10"
                  >
                    <Link to="/student/evaluate-teacher">
                      <Star className="h-3.5 w-3.5" />
                      Evaluate Lecturer
                    </Link>
                  </Button>
                ) : evaluationWindow === "past" ? (
                  <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    <Lock className="h-3.5 w-3.5" />
                    Evaluation Period Closed
                  </div>
                ) : (
                  <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    Semester Not Reached
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openAskModal(course)}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#002147] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-orange-600"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask Lecturer
                </button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <AskQuestionModal
        open={askOpen}
        onOpenChange={setAskOpen}
        course={askCourse}
      />
    </div>
  );
}
