import { PageHeader } from "@/components/portals";
import { Card, CardContent } from "@/components/ui/card";

export function AdminFacultyPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Faculty Management"
        description="Manage faculty profiles, assignments, and contracts."
      />
      <Card className="border-[#E5EBF3]">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          120 active faculty members across 6 faculties.
        </CardContent>
      </Card>
    </div>
  );
}
