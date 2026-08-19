import { PageHeader } from "@/components/portals";
import { Card, CardContent } from "@/components/ui/card";

const results = [
  { course: "CSC-201 Object-Oriented Programming", grade: "A", points: "4.00" },
  { course: "MTH-210 Discrete Mathematics", grade: "A-", points: "3.70" },
  { course: "ENG-205 Academic Writing", grade: "B+", points: "3.30" },
];

export function StudentExamResultsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Exam Results"
        description="Review your published examination grades and GPA impact."
      />
      <div className="grid gap-4">
        {results.map((item) => (
          <Card key={item.course} className="border-[#E5EBF3]">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <p className="font-semibold text-[#002147]">{item.course}</p>
              <div className="text-right">
                <p className="text-lg font-bold text-[#16a34a]">{item.grade}</p>
                <p className="text-xs text-muted-foreground">{item.points} GPA</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
