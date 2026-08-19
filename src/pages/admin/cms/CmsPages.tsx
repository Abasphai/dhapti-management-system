import { Globe } from "lucide-react";

import { CmsFoundationShell } from "./CmsFoundationShell";

export { AdminCmsSettingsPage } from "./CmsSettingsPage";
export { AdminCmsNavigationPage } from "./CmsNavigationPage";
export { AdminCmsHomePage } from "./CmsHomepageEditor";
export { AdminCmsPagesPage } from "./CmsPagesEditor";
export { AdminCmsCustomPagesPage } from "./CmsCustomPagesEditor";
export { AdminCmsNewsPage } from "./CmsNewsEditor";
export { AdminCmsEventsPage } from "./CmsEventsEditor";
export { AdminCmsMediaPage } from "./CmsMediaLibrary";
export { AdminCmsFacultiesPage } from "./CmsFacultiesEditor";
export { AdminCmsProgramsPage } from "./CmsProgramsEditor";

export function AdminCmsOverviewPage() {
  return (
    <CmsFoundationShell
      title="Website CMS"
      description="Manage the public university website — settings, navigation, homepage, About, news, events, media, and faculty/program marketing."
      icon={Globe}
    />
  );
}
