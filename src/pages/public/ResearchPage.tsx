import { Navigate } from "react-router-dom";

/** Research content lives under News & Events (Research filter). */
export function ResearchPage() {
  return <Navigate to="/news" replace />;
}
