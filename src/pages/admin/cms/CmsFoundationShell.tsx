import { Globe, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/portals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "Site Settings", href: "/admin/cms/settings" },
  { label: "Homepage", href: "/admin/cms/home" },
  { label: "Pages", href: "/admin/cms/pages" },
  { label: "Custom Pages", href: "/admin/cms/custom-pages" },
  { label: "News", href: "/admin/cms/news" },
  { label: "Events", href: "/admin/cms/events" },
  { label: "Faculties", href: "/admin/cms/faculties" },
  { label: "Programs", href: "/admin/cms/programs" },
  { label: "Media Library", href: "/admin/cms/media" },
  { label: "Navigation", href: "/admin/cms/navigation" },
];
export function CmsFoundationShell({
  title,
  description,
  icon: Icon = Globe,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={title} description={description} />

      <Card className="border-[#E5EBF3] shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="rounded-lg bg-[#002147]/5 p-2 text-[#002147]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-[#002147]">{title}</CardTitle>
              <Badge variant="info">Phase 2</Badge>
            </div>
            <p className="text-sm font-medium text-slate-600">
              CMS APIs, permissions, and models are live. Site settings and
              navigation editors are available in Phase 2. Homepage and page
              content migration arrive in later phases.
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LINKS.map((item) => (
            <Button key={item.href} asChild variant="outline" size="sm">
              <Link to={item.href}>{item.label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
